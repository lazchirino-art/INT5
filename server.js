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
import NetworkPathHandlerWindows from './backend/network-path-handler-windows.js';
import CredentialCrypto from './backend/credential-crypto.js';
import * as csvUtils from './backend/csv-utils.js';

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
 * POST /api/config/save
 * Save application configuration to backend
 */
app.post('/api/config/save', (req, res) => {
  try {
    const config = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'No configuration provided' });
    }

    // Guardar configuración en archivo
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
		
    console.log('[CONFIG] Configuration saved successfully');
    res.json({ 
      status: 'SUCCESS', 
      message: 'Configuration saved',
      path: CONFIG_FILE
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
	console.log('[DEBUG CONFIG LOADED]:', config);
    
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
    const { productId, searchColumnIndex, returnAllColumns } = req.body;

    // Validate input
    if (!productId || searchColumnIndex === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: productId, searchColumnIndex',
        found: false
      });
    }

    // Load saved configuration
    if (!existsSync(CONFIG_FILE)) {
      return res.status(400).json({
        error: 'No saved configuration found. Please configure connector first.',
        found: false
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    const connectorConfig = config.connection;
    const parserConfig = config.parser;

    console.log(`[PRODUCT SEARCH] Searching for: ${productId}`);

    // Initialize CredentialCrypto
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Decrypt password
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      try {
        password = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[PRODUCT SEARCH] Decryption error:', error.message);
        password = connectorConfig.password;
      }
    }

    // Read file
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username || null,
      password: password || null,
      domain: connectorConfig.domain || null
    });

    if (!fileContent) {
      return res.status(400).json({
        error: 'Failed to read file',
        found: false
      });
    }

    // Parse CSV
    const rows = csvUtils.parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );

    // Search for product
    const result = csvUtils.searchProductInRows(
      rows,
      productId,
      searchColumnIndex,
      parserConfig.columnNames
    );

    console.log(`[PRODUCT SEARCH] Result: ${result.found ? 'FOUND' : 'NOT FOUND'}`);
    res.json(result);

  } catch (error) {
    console.error('[PRODUCT SEARCH ERROR]', error.message);
    res.status(500).json({
      error: error.message,
      found: false
    });
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

    if (!searchCriteria || !searchCriteria.columnName || !searchCriteria.value) {
      return res.status(400).json({
        error: 'Missing required fields: searchCriteria with columnName and value',
        found: false
      });
    }

    // Load configuration
    if (!existsSync(CONFIG_FILE)) {
      return res.status(400).json({
        error: 'No saved configuration found',
        found: false
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    const connectorConfig = config.connection;
    const parserConfig = config.parser;

    console.log(`[ADVANCED SEARCH] Searching: ${searchCriteria.columnName} = ${searchCriteria.value}`);

    // Initialize CredentialCrypto
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Decrypt password
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      try {
        password = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[ADVANCED SEARCH] Decryption error:', error.message);
        password = connectorConfig.password;
      }
    }

    // Read file
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username || null,
      password: password || null,
      domain: connectorConfig.domain || null
    });

    if (!fileContent) {
      return res.status(400).json({
        error: 'Failed to read file',
        found: false
      });
    }

    // Parse CSV
    const rows = csvUtils.parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );

    // Advanced search
    const result = csvUtils.searchProductAdvanced(
      rows,
      searchCriteria,
      parserConfig.columnNames
    );

    console.log(`[ADVANCED SEARCH] Found: ${result.totalFound} results`);
    res.json(result);

  } catch (error) {
    console.error('[ADVANCED SEARCH ERROR]', error.message);
    res.status(500).json({
      error: error.message,
      found: false
    });
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
      return res.status(400).json({
        error: 'Missing required fields: productIds (array), searchColumnIndex',
        found: false
      });
    }

    // Load configuration
    if (!existsSync(CONFIG_FILE)) {
      return res.status(400).json({
        error: 'No saved configuration found',
        found: false
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    const connectorConfig = config.connection;
    const parserConfig = config.parser;

    console.log(`[MULTIPLE SEARCH] Searching for ${productIds.length} products`);

    // Initialize CredentialCrypto
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Decrypt password
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      try {
        password = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[MULTIPLE SEARCH] Decryption error:', error.message);
        password = connectorConfig.password;
      }
    }

    // Read file
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username || null,
      password: password || null,
      domain: connectorConfig.domain || null
    });

    if (!fileContent) {
      return res.status(400).json({
        error: 'Failed to read file',
        found: false
      });
    }

    // Parse CSV
    const rows = csvUtils.parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );

    // Search multiple
    const result = csvUtils.searchMultipleProducts(
      rows,
      productIds,
      searchColumnIndex,
      parserConfig.columnNames
    );

    console.log(`[MULTIPLE SEARCH] Found: ${result.totalFound}/${result.totalSearched}`);
    res.json(result);

  } catch (error) {
    console.error('[MULTIPLE SEARCH ERROR]', error.message);
    res.status(500).json({
      error: error.message,
      found: false
    });
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
    const { filters, limit } = req.body;

    if (!Array.isArray(filters) || filters.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: filters (array)',
        found: false
      });
    }

    // Load configuration
    if (!existsSync(CONFIG_FILE)) {
      return res.status(400).json({
        error: 'No saved configuration found',
        found: false
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    const connectorConfig = config.connection;
    const parserConfig = config.parser;

    console.log(`[FILTER] Applying ${filters.length} filter(s)`);

    // Initialize CredentialCrypto
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Decrypt password
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      try {
        password = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[FILTER] Decryption error:', error.message);
        password = connectorConfig.password;
      }
    }

    // Read file
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username || null,
      password: password || null,
      domain: connectorConfig.domain || null
    });

    if (!fileContent) {
      return res.status(400).json({
        error: 'Failed to read file',
        found: false
      });
    }

    // Parse CSV
    const rows = csvUtils.parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );

    // Filter
    const result = csvUtils.filterProducts(
      rows,
      filters,
      parserConfig.columnNames,
      limit || null
    );

    console.log(`[FILTER] Found: ${result.totalFound} results`);
    res.json(result);

  } catch (error) {
    console.error('[FILTER ERROR]', error.message);
    res.status(500).json({
      error: error.message,
      found: false
    });
  }
});

/**
 * GET /api/product/all
 * Get all products
 */
app.get('/api/product/all', async (req, res) => {
  try {
    // Load configuration
    if (!existsSync(CONFIG_FILE)) {
      return res.status(400).json({
        error: 'No saved configuration found',
        found: false
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    const connectorConfig = config.connection;
    const parserConfig = config.parser;

    console.log('[GET ALL] Loading all products');

    // Initialize CredentialCrypto
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Decrypt password
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      try {
        password = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[GET ALL] Decryption error:', error.message);
        password = connectorConfig.password;
      }
    }

    // Read file
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username || null,
      password: password || null,
      domain: connectorConfig.domain || null
    });

    if (!fileContent) {
      return res.status(400).json({
        error: 'Failed to read file',
        found: false
      });
    }

    // Parse CSV
    const rows = csvUtils.parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );

    // Get all products
    const result = csvUtils.getAllProducts(rows, parserConfig.columnNames);

    console.log(`[GET ALL] Loaded: ${result.totalProducts} products`);
    res.json(result);

  } catch (error) {
    console.error('[GET ALL ERROR]', error.message);
    res.status(500).json({
      error: error.message,
      found: false
    });
  }
});

/**
 * GET /api/product/stats
 * Get CSV statistics
 */
app.get('/api/product/stats', async (req, res) => {
  try {
    // Load configuration
    if (!existsSync(CONFIG_FILE)) {
      return res.status(400).json({
        error: 'No saved configuration found'
      });
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    const connectorConfig = config.connection;
    const parserConfig = config.parser;

    console.log('[STATS] Calculating statistics');

    // Initialize CredentialCrypto
    let credentialCrypto = null;
    if (process.env.ENCRYPTION_SECRET) {
      credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    }

    const handler = new NetworkPathHandlerWindows(credentialCrypto);

    // Decrypt password
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      try {
        password = await credentialCrypto.decrypt(password);
      } catch (error) {
        console.error('[STATS] Decryption error:', error.message);
        password = connectorConfig.password;
      }
    }

    // Read file
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username || null,
      password: password || null,
      domain: connectorConfig.domain || null
    });

    if (!fileContent) {
      return res.status(400).json({
        error: 'Failed to read file'
      });
    }

    // Parse CSV
    const rows = csvUtils.parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );

    // Get statistics
    const stats = csvUtils.getCSVStatistics(rows, parserConfig.columnNames);

    console.log('[STATS] Calculated');
    res.json(stats);

  } catch (error) {
    console.error('[STATS ERROR]', error.message);
    res.status(500).json({
      error: error.message
    });
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
app.listen(PORT, () => {
	console.log('🔥 ESTE ES MI SERVER REAL 🔥');
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Backend Server`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n✔ Server running on port ${PORT}`);
  console.log(`✔ URL: http://localhost:${PORT}`);
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