/**
 * Network Path Handler - Windows Implementation
 *
 * Accede a carpetas compartidas SMB (rutas UNC) en Windows:
 * - Autenticación: `net use` ejecutado SIN shell (execFile con argumentos),
 *   así rutas, usuarios o contraseñas con & | ^ % " no rompen ni inyectan comandos.
 * - Listado y lectura: fs de Node directamente sobre la ruta UNC (independiente
 *   del idioma de Windows y de la página de códigos de la consola).
 */

import { execFile } from 'child_process';
import { readdir, readFile, stat } from 'fs/promises';

const NET_TIMEOUT_MS  = 15000;
const READ_TIMEOUT_MS = 30000;
const MAX_FILE_BYTES  = 50 * 1024 * 1024;

// \\servidor\recurso[\carpeta...]  — sin caracteres inválidos en rutas Windows
const UNC_PATH_RE = /^\\\\[A-Za-z0-9._-]+(\\[^\\/:*?"<>|\x00-\x1f]+)+\\?$/;

/**
 * Decodifica los bytes crudos del archivo detectando su codificación.
 * - UTF-8 con BOM (Excel "CSV UTF-8")    → se quita el BOM
 * - UTF-8 sin BOM                         → tal cual
 * - No es UTF-8 válido                    → Windows-1252 (Excel "CSV" en Windows en español)
 */
function decodeFileBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'UTF-8 (BOM)' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(buf), encoding: 'Windows-1252' };
  }
}

/** Error SMB con indicación de si tiene sentido reintentar. */
function smbError(message, retryable) {
  const err = new Error(message);
  err.retryable = retryable;
  return err;
}

// Los montajes/desmontajes se serializan: un `net use /delete` de una petición
// no puede cortar la sesión que otra petición está estableciendo.
let smbQueue = Promise.resolve();
function withSmbLock(fn) {
  const run = smbQueue.then(fn, fn);
  smbQueue = run.catch(() => {});
  return run;
}

// Caché del archivo leído: se relee solo si cambian fecha de modificación o tamaño.
const fileCache = new Map();

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(smbError(`TIMEOUT<br>${what} took longer than ${ms / 1000} s.`, true)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Ejecuta net.exe sin shell. Nunca rechaza: devuelve código y salida. */
function runNet(args) {
  return new Promise(resolve => {
    execFile('net', args, { timeout: NET_TIMEOUT_MS, windowsHide: true, encoding: 'latin1' }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        output: `${stdout || ''}\n${stderr || ''}`,
        timedOut: Boolean(error && error.killed)
      });
    });
  });
}

/** Código numérico de "System error N" / "Error de sistema N" (dígitos: inmune a la codificación). */
function netErrorCode(output) {
  const match = /(?:system error|error de sistema)\s+(\d+)/i.exec(output);
  return match ? parseInt(match[1], 10) : null;
}

const FOLDER_CHECKS =
  'Verify:<br>' +
  '1. Path is correct: \\\\server\\share\\folder<br>' +
  '2. Server is online and reachable (try ping)<br>' +
  '3. Shared folder exists';

function netError(code, output, timedOut) {
  if (timedOut) {
    return smbError('SERVER NOT REACHABLE<br>The connection attempt timed out.<br>' + FOLDER_CHECKS, true);
  }
  switch (code) {
    case 86:
    case 1326:
      return smbError(
        'AUTHENTICATION FAILED<br>Username or password is incorrect.<br>' +
        'Verify username, password and domain (if used).', false);
    case 1327:
    case 1330:
    case 1331:
    case 1909:
      return smbError(
        `ACCOUNT RESTRICTED (error ${code})<br>` +
        'The account is locked, disabled, expired or not allowed to log on from this PC.', false);
    case 5:
      return smbError(
        'ACCESS DENIED<br>The user does not have permission on this shared folder.<br>' +
        'Check share and folder permissions on the server.', false);
    case 53:
      return smbError('SERVER NOT REACHABLE<br>Cannot connect to the server.<br>' + FOLDER_CHECKS, true);
    case 67:
      return smbError('SHARE NOT FOUND<br>The server does not publish that shared folder name.<br>' + FOLDER_CHECKS, true);
    case 59:
    case 64:
    case 121:
    case 1231:
      return smbError('CONNECTION LOST<br>The connection to the network share was interrupted.', true);
    default: {
      const detail = output.replace(/\s+/g, ' ').trim();
      return smbError(`CANNOT CONNECT TO SHARE${code ? ` (error ${code})` : ''}<br>${detail}`, true);
    }
  }
}

function fsError(error, hasCredentials) {
  switch (error.code) {
    case 'ENOENT':
      return smbError('FOLDER OR FILE NOT FOUND<br>The path does not exist or the server is not reachable.<br>' + FOLDER_CHECKS, true);
    case 'EACCES':
    case 'EPERM':
      return hasCredentials
        ? smbError('ACCESS DENIED<br>The user does not have permission on this folder or file.', false)
        : smbError(
          'FOLDER REQUIRES CREDENTIALS<br>' +
          'This shared folder requires authentication.<br>' +
          'Enable "Authentication" and enter a valid username and password.', false);
    case 'UNKNOWN':
      // Windows no da detalle: servidor apagado, recurso inexistente o acceso anónimo rechazado
      return smbError(
        'SERVER OR SHARE NOT REACHABLE<br>Cannot open the shared folder.<br>' + FOLDER_CHECKS +
        (hasCredentials ? '' : '<br>4. If the folder requires a user, enable "Authentication"'), true);
    case 'EBUSY':
      return smbError('FILE IN USE<br>The file is locked by another process. Try again.', true);
    default:
      return error.retryable !== undefined
        ? error
        : smbError(`CANNOT ACCESS FOLDER<br>Error: ${error.message}`, true);
  }
}

class NetworkPathHandlerWindows {
  constructor(credentialCrypto = null) {
    this.logs = [];
    this.credentialCrypto = credentialCrypto;
  }

  addLog(message) {
    this.logs.push(message);
    console.log(`[LOG] ${message}`);
  }

  /**
   * Convert wildcard pattern to regex
   */
  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Validate UNC path (estricto: también protege los argumentos de net.exe)
   */
  validatePath(path) {
    if (typeof path !== 'string' || !UNC_PATH_RE.test(path)) {
      throw smbError(
        'INVALID PATH FORMAT<br>' +
        'Expected UNC format: \\\\server\\share\\folder<br>' +
        'Example: \\\\192.168.1.100\\compartida\\archivos', false);
    }
    return true;
  }

  /** \\servidor\recurso a partir de una ruta UNC más profunda (net use solo monta recursos). */
  shareRoot(path) {
    const [server, share] = path.replace(/^\\\\/, '').split('\\');
    return `\\\\${server}\\${share}`;
  }

  hasCredentials(credentials) {
    return Boolean(credentials && credentials.username && credentials.password);
  }

  /**
   * Monta el recurso con credenciales.
   * force=true desmonta antes para verificar de verdad usuario/contraseña (Test Connection).
   */
  async mount(path, credentials, force) {
    const root = this.shareRoot(path);
    const user = credentials.domain ? `${credentials.domain}\\${credentials.username}` : credentials.username;
    const connect = () => runNet(['use', root, credentials.password, `/user:${user}`, '/persistent:no']);

    this.addLog(`Mounting share with credentials: ${user}`);
    if (force) await runNet(['use', root, '/delete', '/y']);

    let result = await connect();
    // 1219: ya existe una sesión con otras credenciales → sustituirla
    if (!result.ok && netErrorCode(result.output) === 1219) {
      await runNet(['use', root, '/delete', '/y']);
      result = await connect();
    }
    if (!result.ok) {
      throw netError(netErrorCode(result.output), result.output, result.timedOut);
    }
  }

  /**
   * Ejecuta una operación de fs sobre el recurso.
   * - force: monta antes (verifica credenciales).
   * - si no: intenta con la sesión existente y solo monta si falla.
   */
  async withShareAccess(path, credentials, force, operation) {
    this.validatePath(path);
    const hasCreds = this.hasCredentials(credentials);

    if (hasCreds && force) {
      await withSmbLock(() => this.mount(path, credentials, true));
    }

    try {
      return await operation();
    } catch (error) {
      if (!hasCreds || force || error.retryable === false) throw fsError(error, hasCreds);
      await withSmbLock(() => this.mount(path, credentials, false));
      try {
        return await operation();
      } catch (retryError) {
        throw fsError(retryError, hasCreds);
      }
    }
  }

  /**
   * List files (solo archivos, no carpetas)
   */
  async listFiles(path, credentials, { force = false } = {}) {
    this.addLog('Accessing folder...');
    this.addLog(`Connecting with credentials: ${this.hasCredentials(credentials) ? 'Yes' : 'No'}`);
    if (credentials && credentials.domain) {
      this.addLog(`Domain: ${credentials.domain}`);
    }

    const files = await this.withShareAccess(path, credentials, force, async () => {
      const entries = await withTimeout(readdir(path, { withFileTypes: true }), NET_TIMEOUT_MS, 'Listing the folder');
      const names = [];
      for (const entry of entries) {
        if (entry.isFile()) {
          names.push(entry.name);
        } else if (!entry.isDirectory()) {
          // Puntos de reanálisis (OneDrive, DFS…) se ven como enlaces: comprobar el destino
          const info = await stat(`${path.replace(/\\$/, '')}\\${entry.name}`).catch(() => null);
          if (info && info.isFile()) names.push(entry.name);
        }
      }
      return names;
    });

    this.addLog('Folder accessible');
    this.addLog(`Files found: ${files.length}`);
    return files;
  }

  /**
   * Apply pattern
   */
  applyPattern(files, pattern) {
    const regex = this.patternToRegex(pattern);
    const matching = files.filter(f => regex.test(f));

    this.addLog(`Matching files: ${matching.length}`);
    return matching;
  }

  /**
   * Select file
   */
  selectFile(files) {
    if (files.length === 0) {
      throw smbError(
        'NO FILES FOUND<br>' +
        'No files match the pattern in this folder.<br>' +
        'Verify:<br>' +
        '1. Pattern is correct (use wildcards: *.csv, file_*.csv)<br>' +
        '2. Files exist in the folder<br>' +
        '3. File extension matches the pattern', false);
    }

    if (files.length > 1) {
      throw smbError(
        `MULTIPLE FILES FOUND (${files.length})<br>` +
        `Files: ${files.join(', ')}<br>` +
        'Expected exactly 1 file.<br>' +
        'Verify:<br>' +
        '1. Make pattern more specific<br>' +
        '2. Check if old files should be archived', false);
    }

    const selected = files[0];
    this.addLog(`File selected: ${selected}`);
    return selected;
  }

  /**
   * Read file content (con caché por fecha de modificación y tamaño)
   */
  async readFile({ path, filename, username, password, domain }) {
    const credentials = { username, password, domain };
    const fullPath = `${path.replace(/\\$/, '')}\\${filename}`;
    this.addLog(`Reading file: ${fullPath}`);

    if (/[\\/]/.test(filename) || filename === '..' || filename === '.') {
      throw smbError('INVALID FILE NAME', false);
    }

    const result = await this.withShareAccess(path, credentials, false, async () => {
      const info = await withTimeout(stat(fullPath), READ_TIMEOUT_MS, 'Reading file information');
      if (info.size > MAX_FILE_BYTES) {
        throw smbError(`FILE TOO LARGE<br>${filename} is ${Math.round(info.size / 1048576)} MB (max 50 MB).`, false);
      }

      const cached = fileCache.get(fullPath);
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
        return { ...cached, fromCache: true };
      }

      const buffer = await withTimeout(readFile(fullPath), READ_TIMEOUT_MS, 'Reading the file');
      const decoded = decodeFileBuffer(buffer);
      const entry = { mtimeMs: info.mtimeMs, size: info.size, text: decoded.text, encoding: decoded.encoding };
      fileCache.set(fullPath, entry);
      return entry;
    });

    this.lastEncoding = result.encoding;
    this.addLog(`File read successfully: ${filename} (encoding: ${result.encoding}${result.fromCache ? ', unchanged since last read' : ''})`);
    return result.text;
  }

  /**
   * Execute complete detection (Test Connection: verifica credenciales de verdad)
   */
  async detect(credentials) {
    this.logs = [];
    try {
      // Decrypt password if encrypted and credentialCrypto is available
      if (this.credentialCrypto && credentials.password) {
        this.addLog('Decrypting password...');
        credentials.password = await this.credentialCrypto.decrypt(credentials.password);
        this.addLog('Password decrypted successfully');
      }

      if (!credentials.path || !credentials.pattern) {
        throw smbError(
          'MISSING REQUIRED FIELDS<br>' +
          `1. Path: ${credentials.path ? '✓' : '✗ Required'}<br>` +
          `2. File Name Pattern: ${credentials.pattern ? '✓' : '✗ Required'}`, false);
      }

      this.addLog('Resolving path...');
      this.validatePath(credentials.path);
      this.addLog('Connecting to network share...');

      const files = await this.listFiles(credentials.path, credentials, { force: true });
      const matching = this.applyPattern(files, credentials.pattern);
      const selected = this.selectFile(matching);

      return { status: 'READY', file: selected, logs: this.logs };
    } catch (error) {
      this.addLog(`Error: ${error.message}`);
      return { status: 'FAILED', file: null, logs: this.logs };
    }
  }
}

export default NetworkPathHandlerWindows;
