/**
 * Backend Server - POC Embedded App
 * 
 * Servidor Express que expone endpoint para acceso a SMB
 * Frontend → HTTP → Backend → SMB
 */
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
console.log('SECRET:', process.env.ENCRYPTION_SECRET);
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { networkInterfaces } from 'os';
import { Bonjour } from 'bonjour-service';
import NetworkPathHandlerWindows from './backend/network-path-handler-windows.js';
import CredentialCrypto from './backend/credential-crypto.js';
import * as csvUtils from './backend/csv-utils.js';
import { insertSyncLog, getSyncLog, upsertProduct } from './backend/local-db.js';
import { fetchProduct, extractFields, getValueByPath } from './backend/api-resp-handler.js';

/** Returns all non-loopback IPv4 addresses with their interface names. */
function getLocalIPs() {
  const nets = networkInterfaces();
  const results = [];
  for (const [name, iface] of Object.entries(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ name, address: net.address });
      }
    }
  }
  return results;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_DIR = join(__dirname, 'config');
const CONFIG_FILE = join(CONFIG_DIR, 'app-config.json');

// Asegurar que el directorio de configuración existe
if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos con tipos MIME correctos
app.use('/src/js', express.static(join(__dirname, 'src', 'js'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.use('/src/styles', express.static(join(__dirname, 'src', 'styles'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

app.use('/config', express.static(join(__dirname, 'config'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.use('/src/pages', express.static(join(__dirname, 'src', 'pages')));

// Servir archivos estáticos generales
app.use(express.static(join(__dirname, 'src')));

/**
 * Apply field mapping to a single product object.
 * Renames CSV column keys → JSON tag names. Drops fields with include=false.
 * Falls back to the original object if no mapping is configured.
 */
function applyMapping(product, mappingConfig) {
  if (!product || !Array.isArray(mappingConfig) || mappingConfig.length === 0) {
    return product;
  }
  const mapped = {};
  mappingConfig.forEach(({ csvColumn, jsonTag, include }) => {
    if (include === false) return;
    if (!Object.prototype.hasOwnProperty.call(product, csvColumn)) return;
    mapped[jsonTag] = product[csvColumn];
  });
  return mapped;
}

/**
 * Apply mapping to every product in a list result.
 * Handles arrays of { product, rowIndex } items (used by all, filter, search-multiple).
 */
function applyMappingToList(items, mappingConfig) {
  if (!Array.isArray(items)) return items;
  return items.map(item => ({
    ...item,
    product: applyMapping(item.product, mappingConfig)
  }));
}

/**
 * Load production context shared by all product endpoints:
 *   - Reads and validates app-config.json
 *   - Decrypts SMB credentials
 *   - Reads the CSV file from the network share
 *   - Parses the CSV rows
 *
 * Returns { config, connectorConfig, parserConfig, mappingConfig, rows }
 * Throws an Error with a .statusCode property on any failure.
 */
// Reintentos para el acceso SMB (errores transitorios de red/conexión).
const SMB_MAX_ATTEMPTS   = 3;       // intentos totales
const SMB_RETRY_DELAY_MS = 10000;   // espera entre intentos (10 s)
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Ejecuta fn con reintentos: intento 1 → (espera) → intento 2 → (espera) → intento 3.
 * Si todos fallan, lanza el último error.
 */
async function withSmbRetries(fn) {
  let lastErr;
  for (let attempt = 1; attempt <= SMB_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn(`[SMB] Intento ${attempt}/${SMB_MAX_ATTEMPTS} falló: ${e.message}`);
      if (attempt < SMB_MAX_ATTEMPTS) await sleep(SMB_RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

async function loadProductionContext() {
  if (!existsSync(CONFIG_FILE)) {
    const err = new Error('No saved configuration. Complete the integration setup first.');
    err.statusCode = 400;
    throw err;
  }

  let config;
  try {
    config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    const err = new Error('Configuration file is corrupted or unreadable.');
    err.statusCode = 500;
    throw err;
  }

  const connectorConfig = config.connection || {};
  const parserConfig    = config.parser     || {};
  const mappingConfig   = Array.isArray(config.mapping) ? config.mapping : [];

  if (!connectorConfig.path) {
    const err = new Error('Connector not configured: missing SMB path.');
    err.statusCode = 400;
    throw err;
  }
  if (!connectorConfig.filename && !connectorConfig.fileNamePattern) {
    const err = new Error('Connector not configured: missing file name or pattern. Complete the Connector tab.');
    err.statusCode = 400;
    throw err;
  }
  if (!Array.isArray(parserConfig.columns) || parserConfig.columns.length === 0) {
    const err = new Error('Parser not configured: no columns defined. Complete the Parser tab first.');
    err.statusCode = 400;
    throw err;
  }

  let credentialCrypto = null;
  if (process.env.ENCRYPTION_SECRET) {
    credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
  }

  let password = connectorConfig.password || null;
  if (credentialCrypto && password) {
    try {
      password = await credentialCrypto.decrypt(password);
    } catch (e) {
      console.warn('[loadProductionContext] Password decryption failed, using raw value');
    }
  }

  const handler = new NetworkPathHandlerWindows(credentialCrypto);
  const creds = {
    username: connectorConfig.username || null,
    password: password,
    domain:   connectorConfig.domain   || null
  };

  // Acceso al archivo con reintentos (3 intentos, 10 s entre cada uno).
  // Resuelve el archivo por patrón en cada intento (soporta nombres dinámicos
  // como data_YYYYMMDD.csv) y luego lo lee. Solo se reintenta esta parte SMB:
  // los errores transitorios de red/conexión. "Producto no encontrado" NO se
  // reintenta (se decide en memoria, después de leer el archivo).
  let fileContent;
  try {
    fileContent = await withSmbRetries(async () => {
      let filename = connectorConfig.filename;
      if (!filename) {
        const files    = await handler.listFilesViaPS(connectorConfig.path, creds);
        const matching = handler.applyPattern(files, connectorConfig.fileNamePattern);
        filename       = handler.selectFile(matching); // lanza si 0 o >1 coincidencias
      }
      return await handler.readFile({
        path:     connectorConfig.path,
        filename: filename,
        username: creds.username,
        password: creds.password,
        domain:   creds.domain
      });
    });
  } catch (e) {
    // Los mensajes del handler SMB traen <br> (pensados para el log HTML del
    // wizard). En la API los devolvemos como texto plano.
    const clean = String(e.message || '').replace(/<br\s*\/?>/gi, ' ').replace(/[ \t]+/g, ' ').trim();
    const err = new Error(`No se pudo leer el archivo tras ${SMB_MAX_ATTEMPTS} intentos: ${clean}`);
    err.statusCode = 400;
    throw err;
  }

  if (!fileContent) {
    const err = new Error('Failed to read file from SMB share. Check connector configuration.');
    err.statusCode = 400;
    throw err;
  }

  const rows = csvUtils.parseCSVContent(
    fileContent,
    parserConfig.delimiter  || ',',
    parserConfig.hasHeader  !== false,
    parserConfig.quoteChar  || '"',
    parserConfig.escapeChar || '"'
  );

  return { config, connectorConfig, parserConfig, mappingConfig, rows };
}

/**
 * POST /api/config/save
 * Save application configuration to backend
 */
app.post('/api/config/save', (req, res) => {
  try {
    const newConfig = req.body;
    
    if (!newConfig) {
      return res.status(400).json({ error: 'No configuration provided' });
    }

    // Load existing configuration if it exists
    let existingConfig = {};
    if (existsSync(CONFIG_FILE)) {
      try {
        const configData = readFileSync(CONFIG_FILE, 'utf-8');
        existingConfig = JSON.parse(configData);
      } catch (e) {
        console.warn('[CONFIG] Could not load existing config, starting fresh');
      }
    }

    // Merge configurations — each tab saves only its own section.
    // Guard: if a section is double-nested (e.g. connection.connection) unwrap it.
    const unwrap = (val, key) =>
      val && typeof val === 'object' && val[key] ? val[key] : val;

    // Deep-merge apiResp sub-sections so each tab saves only its own key
    const existingApiResp = existingConfig.apiResp || {};
    const newApiResp      = newConfig.apiResp      || {};
    const mergedApiResp   = Object.keys(newApiResp).length > 0
      ? {
          connector:   newApiResp.connector   || existingApiResp.connector   || {},
          schema:      newApiResp.schema      || existingApiResp.schema      || [],
          mapping:     newApiResp.mapping     || existingApiResp.mapping     || [],
          validation:  newApiResp.validation  || existingApiResp.validation  || [],
          persistence: newApiResp.persistence || existingApiResp.persistence || {}
        }
      : existingApiResp;

    const mergedConfig = {
      connection:  unwrap(newConfig.connection, 'connection') || unwrap(existingConfig.connection, 'connection') || {},
      parser:      newConfig.parser      || existingConfig.parser      || {},
      mapping:     newConfig.mapping     || existingConfig.mapping     || [],
      validation:  newConfig.validation  || existingConfig.validation  || [],
      persistence: newConfig.persistence || existingConfig.persistence || {},
      // Column (by index) that holds the product code production searches by.
      searchColumnIndex: newConfig.searchColumnIndex ?? existingConfig.searchColumnIndex ?? null,
      apiResp:     mergedApiResp
    };

    console.log('[CONFIG] Saving configuration...');
    console.log('[CONFIG] Connection:', mergedConfig.connection);
    console.log('[CONFIG] Parser:',     mergedConfig.parser);
    console.log('[CONFIG] Mapping:',    mergedConfig.mapping);

    // Guardar configuración en archivo
    writeFileSync(CONFIG_FILE, JSON.stringify(mergedConfig, null, 2));

    console.log('[CONFIG] Configuration saved successfully');
    res.json({ 
      status: 'SUCCESS', 
      success: true,
      message: 'Configuration saved',
      path: CONFIG_FILE,
      config: mergedConfig
    });
  } catch (error) {
    console.error('[CONFIG ERROR]', error.message);
    res.status(500).json({ 
      status: 'FAILED', 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/config/load
 * Load application configuration from backend
 */
app.get('/api/config/load', (req, res) => {
  try {
    if (!existsSync(CONFIG_FILE)) {
      console.log('[CONFIG] No saved configuration found');
      return res.json({ 
        status: 'NOT_FOUND', 
        config: null,
        message: 'No saved configuration'
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);

    console.log('[CONFIG] Configuration loaded successfully');
    res.json({ 
      status: 'SUCCESS', 
      config: config
    });
  } catch (error) {
    console.error('[CONFIG ERROR]', error.message);
    res.status(500).json({ 
      status: 'FAILED', 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/config/clear
 * Clear saved configuration
 */
app.delete('/api/config/clear', (req, res) => {
  try {
    if (existsSync(CONFIG_FILE)) {
      // Crear backup antes de eliminar
      const backupFile = join(CONFIG_DIR, `app-config.backup.${Date.now()}.json`);
      const configData = readFileSync(CONFIG_FILE, 'utf-8');
      writeFileSync(backupFile, configData, 'utf-8');
      
      // Eliminar archivo de configuración
      unlinkSync(CONFIG_FILE);
      console.log('[CONFIG] Configuration cleared, backup saved to:', backupFile);
    }
    
    res.json({ 
      status: 'SUCCESS', 
      message: 'Configuration cleared'
    });
  } catch (error) {
    console.error('[CONFIG ERROR]', error.message);
    res.status(500).json({ 
      status: 'FAILED', 
      error: error.message 
    });
  }
});

/**
 * POST /test-connection
 * 
 * Test connection to network path and detect file
 * 
 * Request body:
 * {
 *   "path": "\\\\server\\share\\folder",
 *   "username": "user",
 *   "password": "pass",
 *   "domain": "DOMAIN" (optional),
 *   "pattern": "*.csv"
 * }
 * 
 * Response:
 * {
 *   "status": "READY" | "FAILED",
 *   "file": "filename.csv" | null,
 *   "logs": ["log1", "log2", ...]
 * }
 */
app.post('/test-connection', async (req, res) => {
  try {
    const { path, username, password, domain, pattern } = req.body;

    // Validar entrada
    const missingFields = [];
    if (!path) missingFields.push('Path');
    if (!pattern) missingFields.push('File Name Pattern');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'FAILED',
        file: null,
        logs: [
          'MISSING REQUIRED FIELDS: ' + missingFields.join(', '),
          '',
          'Please fill in:',
          '1. Path (UNC format): \\\\\\\\server\\\\share\\\\folder',
          '2. File Name Pattern: *.csv or medications_*.csv',
          '',
          'Example:',
          'Path: \\\\\\\\Desktop-ibfsjcq\\\\int5\\\\archivos',
          'Pattern: *.csv'
        ]
      });
    }
    
    // Validar formato de ruta
    if (!path.startsWith('\\\\')) {
      return res.status(400).json({
        status: 'FAILED',
        file: null,
        logs: [
          'INVALID PATH FORMAT',
          '',
          'Path must be in UNC format: \\\\\\\\server\\\\share\\\\folder',
          '',
          'Your input: ' + path,
          '',
          'Examples of valid paths:',
          '✓ \\\\\\\\Desktop-ibfsjcq\\\\int5',
          '✓ \\\\\\\\192.168.1.100\\\\compartida\\\\archivos',
          '✓ \\\\\\\\servidor-produccion\\\\medicinas\\\\entrada'
        ]
      });
    }

    console.log(`\n[REQUEST] Testing connection to: ${path}`);

    // Initialize CredentialCrypto with encryption secret
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    // Crear handler
    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Ejecutar detección
    const result = await handler.detect({
      path,
      username,
      password,
      domain: domain || null,
      pattern
    });

    // Retornar resultado
    res.json(result);

  } catch (error) {
    console.error('[ERROR]', error.message);
    res.status(500).json({
      status: 'FAILED',
      file: null,
      logs: [`Error: ${error.message}`]
    });
  }
});

/**
 * POST /api/connector/read-file
 */
 
app.post('/api/connector/read-file', async (req, res) => {
	console.log('🔥 READ FILE CALLED 🔥');
	console.log('[DEBUG REQUEST BODY]:', req.body);
  try {
    const { connectorType, path, fileNamePattern, username, password, domain, useAuthentication } = req.body;

    if (!connectorType || !path || !fileNamePattern) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (connectorType !== 'networkPath') {
      return res.status(400).json({ error: 'Only networkPath supported' });
    }

    console.log(`[API] Reading file from: ${path}`);
    
    // Initialize CredentialCrypto with encryption secret
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }
    
    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    const detectResult = await handler.detect({
      path,
      username: useAuthentication ? username : null,
      password: useAuthentication ? password : null,
      domain: useAuthentication && domain ? domain : null,
      pattern: fileNamePattern
    });

    if (detectResult.status !== 'READY' || !detectResult.file) {
      return res.status(400).json({ error: { message: 'File not found' }, logs: detectResult.logs });
    }

    // Decrypt password if needed before passing to readFile
    let decryptedPassword = password;
    if (credentialCrypto && password) {
      try {
        decryptedPassword = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[API] Decryption error:', error.message);
        // If decryption fails, try with original password
        decryptedPassword = password;
      }
    }
    
    const fileContent = await handler.readFile({
      path,
      filename: detectResult.file,
      username: useAuthentication ? username : null,
      password: useAuthentication ? decryptedPassword : null,
      domain: useAuthentication && domain ? domain : null
    });

    if (!fileContent) {
      return res.status(400).json({ error: { message: 'Failed to read file' } });
    }

    res.json({ content: fileContent, filename: detectResult.file, size: fileContent.length, encoding: 'UTF-8' });
  } catch (error) {
    console.error('[API ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/product/search
 * Search for a product by identifier
 * 
 * Request body:
 * {
 *   "productId": "ASP001",
 *   "searchColumnIndex": 1,
 *   "returnAllColumns": true
 * }
 * 
 * Response:
 * {
 *   "found": true,
 *   "product": {...},
 *   "rowIndex": 42,
 *   "totalRows": 131,
 *   "searchTime": 245
 * }
 */
app.post('/api/product/search', async (req, res) => {
  try {
    const { productId, searchColumnIndex } = req.body;

    if (!productId || searchColumnIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields: productId, searchColumnIndex', found: false });
    }

    const { parserConfig, mappingConfig, rows } = await loadProductionContext();

    console.log(`[PRODUCT SEARCH] Searching for: ${productId}`);
    const result = csvUtils.searchProductInRows(rows, productId, searchColumnIndex, parserConfig.columns);

    if (result.found && result.product) {
      result.product = applyMapping(result.product, mappingConfig);
    }

    console.log(`[PRODUCT SEARCH] Result: ${result.found ? 'FOUND' : 'NOT FOUND'}`);
    res.json(result);

  } catch (error) {
    console.error('[PRODUCT SEARCH ERROR]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message, found: false });
  }
});

/**
 * POST /api/product/search-advanced
 * Advanced search with multiple criteria
 * 
 * Request body:
 * {
 *   "searchCriteria": {
 *     "columnName": "MedicationName",
 *     "value": "Aspirin",
 *     "exact": false,
 *     "caseSensitive": false
 *   }
 * }
 */
app.post('/api/product/search-advanced', async (req, res) => {
  try {
    const { searchCriteria } = req.body;

    if (!searchCriteria || !searchCriteria.columnName || searchCriteria.value === undefined) {
      return res.status(400).json({ error: 'Missing required fields: searchCriteria with columnName and value', found: false });
    }

    const { parserConfig, mappingConfig, rows } = await loadProductionContext();

    const col = parserConfig.columns.find(c => c.name === searchCriteria.columnName);
    if (!col) {
      return res.status(400).json({ error: `Column "${searchCriteria.columnName}" not found in parser configuration`, found: false });
    }

    const operator = searchCriteria.exact === false ? 'contains' : 'equals';
    const criteria = { columnIndex: col.index, value: searchCriteria.value, operator };

    console.log(`[ADVANCED SEARCH] ${searchCriteria.columnName}[${col.index}] ${operator} "${searchCriteria.value}"`);
    const result = csvUtils.searchProductAdvanced(rows, criteria, parserConfig.columns);

    if (result.found && result.product) {
      result.product = applyMapping(result.product, mappingConfig);
    }

    console.log(`[ADVANCED SEARCH] Found: ${result.found}`);
    res.json(result);

  } catch (error) {
    console.error('[ADVANCED SEARCH ERROR]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message, found: false });
  }
});

/**
 * POST /api/product/search-multiple
 * Search for multiple products
 * 
 * Request body:
 * {
 *   "productIds": ["ASP001", "IBU002", "ACE003"],
 *   "searchColumnIndex": 1
 * }
 */
app.post('/api/product/search-multiple', async (req, res) => {
  try {
    const { productIds, searchColumnIndex } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0 || searchColumnIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields: productIds (array), searchColumnIndex', found: false });
    }

    const { parserConfig, mappingConfig, rows } = await loadProductionContext();

    console.log(`[MULTIPLE SEARCH] Searching for ${productIds.length} products`);
    const result = csvUtils.searchMultipleProducts(rows, productIds, searchColumnIndex, parserConfig.columns);

    if (Array.isArray(result.products)) {
      result.products = result.products.map(item => ({
        ...item,
        product: applyMapping(item.product, mappingConfig)
      }));
    }

    console.log(`[MULTIPLE SEARCH] Found: ${result.totalFound}/${productIds.length}`);
    res.json(result);

  } catch (error) {
    console.error('[MULTIPLE SEARCH ERROR]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message, found: false });
  }
});

/**
 * POST /api/product/filter
 * Filter products by criteria
 * 
 * Request body:
 * {
 *   "filters": [
 *     {"columnName": "Status", "value": "Active"},
 *     {"columnName": "Price", "value": "10", "operator": "lt"}
 *   ],
 *   "limit": 50
 * }
 */
app.post('/api/product/filter', async (req, res) => {
  try {
    const { filters } = req.body;

    if (!Array.isArray(filters) || filters.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: filters (array of {columnName, value})', found: false });
    }

    const { parserConfig, mappingConfig, rows } = await loadProductionContext();

    const filterCriteria = {};
    for (const f of filters) {
      const col = parserConfig.columns.find(c => c.name === f.columnName);
      if (!col) {
        return res.status(400).json({ error: `Column "${f.columnName}" not found in parser configuration`, found: false });
      }
      filterCriteria[col.index] = f.value;
    }

    console.log(`[FILTER] Applying ${filters.length} filter(s)`);
    const result = csvUtils.filterProducts(rows, filterCriteria, parserConfig.columns);

    result.products = applyMappingToList(result.products, mappingConfig);

    console.log(`[FILTER] Found: ${result.totalFound} results`);
    res.json(result);

  } catch (error) {
    console.error('[FILTER ERROR]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message, found: false });
  }
});

/**
 * GET /api/product/all
 * Get all products
 */
app.get('/api/product/all', async (req, res) => {
  try {
    const { parserConfig, mappingConfig, rows } = await loadProductionContext();

    console.log('[GET ALL] Loading all products');
    const result = csvUtils.getAllProducts(rows, parserConfig.columns);

    result.products = applyMappingToList(result.products, mappingConfig);

    console.log(`[GET ALL] Loaded: ${result.totalFound} products`);
    res.json(result);

  } catch (error) {
    console.error('[GET ALL ERROR]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message, found: false });
  }
});

/**
 * POST /api/product/import
 * Search CSV for a product, validate required fields, cache it, and log the attempt.
 *
 * Request body:
 * {
 *   "productCode":        "ASP001",
 *   "searchColumnIndex":  1,
 *   "confirmed":          false   // optional — only meaningful when triggerMode is "manual"
 * }
 *
 * Response shapes:
 *   { status: "IMPORTED",              product: {...}, fieldsImported: N }
 *   { status: "NOT_FOUND"                                                }
 *   { status: "VALIDATION_FAILED",     message: "..."                   }
 *   { status: "CONFIRMATION_REQUIRED", message: "...", preview: {...}   }
 */
app.post('/api/product/import', async (req, res) => {
  const {
    productCode,
    searchColumnIndex,
    confirmed = false,
    requestedBy = 'unknown',   // operator that triggered the request (sent by production app)
    confirmedBy = null         // operator/supervisor that validated (manual mode confirmation)
  } = req.body || {};
  const timestamp = new Date().toISOString();

  if (!productCode) {
    return res.status(400).json({ error: 'Missing required field: productCode' });
  }

  let context;
  try {
    context = await loadProductionContext();
  } catch (err) {
    insertSyncLog({ timestamp, productCode, result: 'ERROR', fields: null, error: err.message, requestedBy, confirmedBy });
    return res.status(err.statusCode || 500).json({ error: err.message, status: 'ERROR' });
  }

  const { parserConfig, mappingConfig, rows, config } = context;

  // Search column: request value (override) → saved config → error if neither.
  // Production normally sends only productCode; the column is configured once.
  const effectiveSearchIndex = (searchColumnIndex ?? config.searchColumnIndex);
  if (effectiveSearchIndex === undefined || effectiveSearchIndex === null) {
    const msg = 'Search column not configured. Set it in the Mapping tab (Search Column).';
    insertSyncLog({ timestamp, productCode, result: 'ERROR', fields: null, error: msg, requestedBy, confirmedBy });
    return res.status(400).json({ error: msg, status: 'ERROR' });
  }
  const validationRules = Array.isArray(config.validation) ? config.validation : [];
  const persistence     = config.persistence || {};
  const triggerMode     = persistence.triggerMode || 'auto';
  const validationLevel = persistence.validationLevel || 'superior';

  // ── Search CSV ────────────────────────────────────────────────────────
  const searchResult = csvUtils.searchProductInRows(rows, productCode, effectiveSearchIndex, parserConfig.columns);

  if (!searchResult.found || !searchResult.product) {
    insertSyncLog({ timestamp, productCode, result: 'NOT_FOUND', fields: null, error: '', requestedBy, confirmedBy });
    return res.json({ status: 'NOT_FOUND', productCode });
  }

  const mappedProduct = applyMapping(searchResult.product, mappingConfig);

  // ── Validate required fields ─────────────────────────────────────────
  for (const rule of validationRules) {
    if (!rule.required) continue;
    const value = mappedProduct[rule.jsonTag];
    if (value === undefined || value === null || String(value).trim() === '') {
      const message = `Product found in CSV but with incomplete data — field [${rule.jsonTag}] is empty`;
      insertSyncLog({ timestamp, productCode, result: 'VALIDATION_FAILED', fields: mappedProduct, error: message, requestedBy, confirmedBy });
      return res.json({ status: 'VALIDATION_FAILED', message, productCode });
    }
  }

  // ── Manual mode: ask for confirmation before importing ────────────────
  if (triggerMode === 'manual' && !confirmed) {
    return res.json({
      status:          'CONFIRMATION_REQUIRED',
      message:         `Product "${productCode}" found. Confirm import?`,
      validationLevel,                 // production decides: superior login vs same-user button
      preview:         mappedProduct,
      productCode
    });
  }

  // ── Import: cache + log ───────────────────────────────────────────────
  try {
    upsertProduct({ productCode, data: mappedProduct });
  } catch (cacheErr) {
    console.warn('[IMPORT] Cache write failed:', cacheErr.message);
  }

  insertSyncLog({ timestamp, productCode, result: 'FOUND', fields: mappedProduct, error: '', requestedBy, confirmedBy });

  return res.json({
    status:    'IMPORTED',
    productCode,
    product:   mappedProduct,
    rowIndex:  searchResult.rowIndex
  });
});

/**
 * GET /api/sync-log
 * Return paginated sync log entries, newest first.
 *
 * Query params:
 *   page  — 1-based (default 1)
 *   limit — entries per page (default 20)
 *
 * Response:
 * {
 *   "entries":    [...],
 *   "total":      42,
 *   "page":       1,
 *   "totalPages": 3
 * }
 */
app.get('/api/sync-log', (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = getSyncLog({ page, limit });
    res.json(result);
  } catch (err) {
    console.error('[SYNC LOG ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/product/stats
 * Get CSV statistics
 */
app.get('/api/product/stats', async (req, res) => {
  try {
    const { parserConfig, rows } = await loadProductionContext();

    console.log('[STATS] Calculating statistics');
    const stats = csvUtils.getCSVStatistics(rows, parserConfig.columns);

    console.log('[STATS] Calculated');
    res.json(stats);

  } catch (error) {
    console.error('[STATS ERROR]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * POST /api/apiResp/test-connection
 * Test an API-RESP connector by making a real HTTP request.
 *
 * Body: { connector, testProductCode } — inline connector config for live test
 *    OR { useStoredConnector: true, testProductCode } — use saved config.apiResp.connector
 *
 * Response:
 *   { status: 'SUCCESS', rawJson: {...}, fieldCount: N, preview: '...' }
 *   { status: 'FAILED',  error: '...' }
 */
app.post('/api/apiResp/test-connection', async (req, res) => {
  const { connector: inlineConnector, testProductCode = 'TEST001', useStoredConnector = false } = req.body || {};

  let connector = inlineConnector;

  if (useStoredConnector) {
    if (!existsSync(CONFIG_FILE)) {
      return res.json({ status: 'FAILED', error: 'No saved configuration. Save the Connector tab first.' });
    }
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      connector = config?.apiResp?.connector;
    } catch (e) {
      return res.json({ status: 'FAILED', error: 'Failed to read saved configuration.' });
    }
  }

  if (!connector?.baseUrl || !connector?.path) {
    return res.json({ status: 'FAILED', error: 'Base URL and Endpoint Path are required.' });
  }

  try {
    const rawJson   = await fetchProduct(connector, testProductCode);
    const fields    = extractFields(rawJson);
    const preview   = JSON.stringify(rawJson).slice(0, 200);
    res.json({ status: 'SUCCESS', rawJson, fieldCount: fields.length, preview });
  } catch (err) {
    res.json({ status: 'FAILED', error: err.message });
  }
});

/**
 * POST /api/product/import-api
 * Import a product via API-RESP integration.
 *
 * Body:
 *   { productCode, confirmed? }
 *
 * Response shapes (mirror /api/product/import):
 *   { status: 'IMPORTED',              product: {...}, fieldsImported: N }
 *   { status: 'NOT_FOUND'                                                }
 *   { status: 'VALIDATION_FAILED',     message: '...'                   }
 *   { status: 'CONFIRMATION_REQUIRED', message: '...', preview: {...}   }
 *   { status: 'ERROR',                 error: '...'                     }
 */
app.post('/api/product/import-api', async (req, res) => {
  const {
    productCode,
    confirmed = false,
    requestedBy = 'unknown',
    confirmedBy = null
  } = req.body || {};
  const timestamp = new Date().toISOString();

  if (!productCode) {
    return res.status(400).json({ error: 'Missing required field: productCode', status: 'ERROR' });
  }

  if (!existsSync(CONFIG_FILE)) {
    return res.status(400).json({ error: 'No saved configuration. Complete the API-RESP setup first.', status: 'ERROR' });
  }

  let appConfig;
  try {
    appConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    return res.status(500).json({ error: 'Configuration file is corrupted.', status: 'ERROR' });
  }

  const apiResp       = appConfig.apiResp || {};
  const connector     = apiResp.connector     || {};
  const schemaFields  = Array.isArray(apiResp.schema)     ? apiResp.schema.filter(s => s.include !== false) : [];
  const mappingConfig = Array.isArray(apiResp.mapping)    ? apiResp.mapping.filter(m => m.include !== false) : [];
  const validRules    = Array.isArray(apiResp.validation) ? apiResp.validation : [];
  const triggerMode   = apiResp.persistence?.triggerMode || 'auto';
  const validationLevel = apiResp.persistence?.validationLevel || 'superior';

  if (!connector.baseUrl || !connector.path) {
    return res.status(400).json({ error: 'API connector not configured. Complete the Connector tab first.', status: 'ERROR' });
  }

  // ── Fetch from external API ───────────────────────────────────────────
  let rawJson;
  try {
    rawJson = await fetchProduct(connector, productCode);
  } catch (err) {
    insertSyncLog({ timestamp, productCode, result: 'NOT_FOUND', fields: null, error: err.message, source: 'apiResp', requestedBy, confirmedBy });
    return res.json({ status: 'NOT_FOUND', productCode, error: err.message });
  }

  if (!rawJson || typeof rawJson !== 'object') {
    insertSyncLog({ timestamp, productCode, result: 'NOT_FOUND', fields: null, error: 'Empty or non-JSON response', source: 'apiResp', requestedBy, confirmedBy });
    return res.json({ status: 'NOT_FOUND', productCode });
  }

  // ── Extract included fields → flat object ────────────────────────────
  const flatProduct = {};
  if (schemaFields.length > 0) {
    schemaFields.forEach(field => {
      flatProduct[field.path] = getValueByPath(rawJson, field.path);
    });
  } else {
    // No schema: use all detected fields
    extractFields(rawJson).forEach(f => { flatProduct[f.path] = f.value; });
  }

  // ── Apply mapping (fieldPath → jsonTag) ─────────────────────────────
  let mappedProduct;
  if (mappingConfig.length > 0) {
    mappedProduct = {};
    mappingConfig.forEach(({ fieldPath, jsonTag }) => {
      if (fieldPath in flatProduct) mappedProduct[jsonTag] = flatProduct[fieldPath];
    });
  } else {
    mappedProduct = flatProduct;
  }

  // ── Validate required fields ─────────────────────────────────────────
  for (const rule of validRules) {
    if (!rule.required) continue;
    const value = mappedProduct[rule.jsonTag];
    if (value === undefined || value === null || String(value).trim() === '') {
      const message = `Product found in API but with incomplete data — field [${rule.jsonTag}] is empty`;
      insertSyncLog({ timestamp, productCode, result: 'VALIDATION_FAILED', fields: mappedProduct, error: message, source: 'apiResp', requestedBy, confirmedBy });
      return res.json({ status: 'VALIDATION_FAILED', message, productCode });
    }
  }

  // ── Manual mode: ask for confirmation before importing ────────────────
  if (triggerMode === 'manual' && !confirmed) {
    return res.json({
      status:          'CONFIRMATION_REQUIRED',
      message:         `Product "${productCode}" found. Confirm import?`,
      validationLevel,
      preview:         mappedProduct,
      productCode
    });
  }

  // ── Import: cache + log ───────────────────────────────────────────────
  try {
    upsertProduct({ productCode, data: mappedProduct });
  } catch (cacheErr) {
    console.warn('[IMPORT-API] Cache write failed:', cacheErr.message);
  }

  insertSyncLog({ timestamp, productCode, result: 'FOUND', fields: mappedProduct, error: '', source: 'apiResp', requestedBy, confirmedBy });

  return res.json({
    status:    'IMPORTED',
    productCode,
    product:   mappedProduct
  });
});

/**
 * GET /api/product/search-column
 * Devuelve la columna de búsqueda configurada (índice + nombre).
 * Pensado para que la app de producción sepa por qué columna se busca,
 * sin exponer el resto de la configuración (credenciales, etc.).
 */
app.get('/api/product/search-column', (req, res) => {
  try {
    if (!existsSync(CONFIG_FILE)) return res.json({ configured: false });
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    const idx = config.searchColumnIndex;
    if (idx === undefined || idx === null) return res.json({ configured: false });
    const cols = Array.isArray(config.parser?.columns) ? config.parser.columns : [];
    const col = cols.find(c => c.index === idx);
    res.json({ configured: true, searchColumnIndex: idx, columnName: col ? col.name : null });
  } catch (e) {
    res.status(500).json({ configured: false, error: e.message });
  }
});

/**
 * GET /
 * Serve main page
 */
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'src', 'pages', 'index.html'));
});

/**
 * GET /:page
 * Serve other pages
 */
app.get('/:page', (req, res) => {
  const page = req.params.page;
  const filePath = join(__dirname, 'src', 'pages', decodeURIComponent(page));
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('Page not found');
    }
  });
});

/**
 * Error handling
 */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    status: 'FAILED',
    file: null,
    logs: [`Server error: ${err.message}`]
  });
});

/**
 * Start server
 */
app.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPs();

  // Announce service via mDNS so any device on the network can reach http://int5.local:PORT
  const bonjour = new Bonjour();
  bonjour.publish({ name: 'INT5', type: 'http', port: PORT, host: 'int5.local' });

  console.log('🔥 ESTE ES MI SERVER REAL 🔥');
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Backend Server`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n✔ Server running on port ${PORT}`);
  console.log(`✔ Local:   http://localhost:${PORT}`);
  console.log(`✔ mDNS:    http://int5.local:${PORT}  ← PC y teléfono (misma red)`);
  localIPs.forEach(({ name, address }) => {
    console.log(`✔ Network: http://${address}:${PORT}  [${name}]`);
  });
  console.log(`✔ Endpoint: POST /test-connection`);
  console.log(`✔ Config API: POST /api/config/save`);
  console.log(`✔ Config API: GET /api/config/load`);
  console.log(`✔ Config API: DELETE /api/config/clear`);
  console.log(`✔ Product API: POST /api/product/search`);
  console.log(`✔ Product API: POST /api/product/search-advanced`);
  console.log(`✔ Product API: POST /api/product/search-multiple`);
  console.log(`✔ Product API: POST /api/product/filter`);
  console.log(`✔ Product API: GET /api/product/all`);
  console.log(`✔ Product API: GET /api/product/stats`);
  console.log(`✔ Import API:  POST /api/product/import`);
  console.log(`✔ Sync Log:    GET /api/sync-log`);
  console.log(`✔ Config file: ${CONFIG_FILE}`);
  console.log(`\n${'='.repeat(50)}\n`);
});

// Load configuration on startup
console.log('[CONFIG] Loading saved configuration on startup...');
if (existsSync(CONFIG_FILE)) {
  try {
    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    console.log('[CONFIG] Configuration loaded from file:', CONFIG_FILE);
  } catch (error) {
    console.error('[CONFIG] Error loading configuration:', error.message);
  }
} else {
  console.log('[CONFIG] No saved configuration file found');
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  process.exit(1);
});
console.log('CONFIG FILE PATH:', CONFIG_FILE);