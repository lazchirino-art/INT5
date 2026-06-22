/**
 * SMB File Detector Backend - Node.js
 * 
 * Módulo que usa smb2 para acceder a rutas de red (SMB) y detectar archivos CSV
 * 
 * CARACTERÍSTICAS:
 * - Conexión real a SMB usando smb2
 * - Listado de archivos
 * - Coincidencia de patrones
 * - Validación paso a paso
 * - Logs detallados
 * - Manejo robusto de errores
 */

import SMB2 from 'smb2';

class SMB2FileDetector {
  /**
   * Constructor
   */
  constructor() {
    this.logs = [];
    this.state = {
      pathResolved: false,
      connected: false,
      authenticated: false,
      folderAccessible: false,
      filesListed: false,
      fileSelected: false
    };
    this.result = {
      status: 'IDLE',
      selectedFile: null,
      logs: []
    };
  }

  /**
   * Agregar log
   */
  addLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'success': '✔',
      'error': '❌',
      'warning': '⚠',
      'info': 'ℹ'
    }[type] || 'ℹ';

    const logEntry = {
      timestamp,
      message,
      type,
      prefix: `${prefix} ${message}`
    };

    this.logs.push(logEntry);
    console.log(logEntry.prefix);
    return logEntry;
  }

  /**
   * Validar credenciales
   */
  validateCredentials(credentials) {
    const errors = [];

    if (!credentials) {
      errors.push('Credenciales no proporcionadas');
      return { valid: false, errors };
    }

    if (!credentials.path || typeof credentials.path !== 'string') {
      errors.push('Path no válido o no proporcionado');
    }

    if (!credentials.username || typeof credentials.username !== 'string') {
      errors.push('Username no válido o no proporcionado');
    }

    if (!credentials.password || typeof credentials.password !== 'string') {
      errors.push('Password no válido o no proporcionado');
    }

    if (credentials.pattern && typeof credentials.pattern !== 'string') {
      errors.push('Pattern debe ser un string');
    }

    if (credentials.domain && typeof credentials.domain !== 'string') {
      errors.push('Domain debe ser un string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Resolver ruta UNC
   */
  resolvePath(path) {
    try {
      this.addLog(`Resolviendo ruta: ${path}`, 'info');

      // Normalizar separadores
      const normalizedPath = path.replace(/\//g, '\\');

      // Validar que sea UNC
      if (!normalizedPath.startsWith('\\\\')) {
        throw new Error('La ruta debe ser UNC (\\\\servidor\\compartida)');
      }

      // Parsear componentes
      const parts = normalizedPath.split('\\').filter(p => p.length > 0);
      if (parts.length < 2) {
        throw new Error('La ruta debe tener al menos servidor y compartida');
      }

      this.state.pathResolved = true;
      this.addLog(`Ruta resuelta: ${normalizedPath}`, 'success');

      return {
        success: true,
        path: normalizedPath,
        server: parts[0],
        share: parts[1],
        subfolder: parts.slice(2).join('\\')
      };
    } catch (error) {
      this.addLog(`Error resolviendo ruta: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Construir credencial de usuario
   */
  buildUserCredential(username, domain) {
    if (domain && domain.trim().length > 0) {
      return `${domain}\\${username}`;
    }
    return username;
  }

  /**
   * Convertir patrón a regex
   */
  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Conectar a SMB
   */
  async connectToSMB(params) {
    try {
      this.addLog(`Conectando a: \\\\${params.server}\\${params.share}`, 'info');

      const userCredential = this.buildUserCredential(params.username, params.domain);
      this.addLog(`Autenticando como: ${userCredential}`, 'info');

      // Crear cliente SMB2
      const smbClient = new SMB2({
        host: params.server,
        username: params.username,
        password: params.password,
        domain: params.domain || undefined,
        share: params.share
      });

      this.state.connected = true;
      this.addLog(`Conexión exitosa`, 'success');

      this.state.authenticated = true;
      this.addLog(`Autenticación exitosa`, 'success');

      return {
        success: true,
        client: smbClient
      };
    } catch (error) {
      this.addLog(`Error en conexión: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Listar archivos en carpeta SMB
   */
  async listFilesInSMB(client, subfolder) {
    try {
      this.addLog(`Listando archivos en carpeta`, 'info');

      const folderPath = subfolder ? `\\${subfolder}` : '\\';

      return new Promise((resolve, reject) => {
        client.readdir(folderPath, (error, files) => {
          if (error) {
            reject(error);
          } else {
            resolve(files || []);
          }
        });
      });
    } catch (error) {
      this.addLog(`Error listando archivos: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Aplicar patrón a lista de archivos
   */
  applyPattern(files, pattern) {
    try {
      this.addLog(`Aplicando patrón: ${pattern}`, 'info');

      const regex = this.patternToRegex(pattern);
      
      // Filtrar solo archivos (no directorios)
      const matchingFiles = files
        .filter(file => !file.isDirectory)
        .map(file => file.filename)
        .filter(filename => regex.test(filename));

      this.addLog(`Archivos coincidentes: ${matchingFiles.length}`, 'info');

      return matchingFiles;
    } catch (error) {
      this.addLog(`Error aplicando patrón: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Seleccionar archivo basado en reglas
   */
  selectFile(matchingFiles) {
    if (matchingFiles.length === 0) {
      this.addLog(`Archivo no encontrado`, 'error');
      return {
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'No se encontró ningún archivo que coincida con el patrón'
      };
    }

    if (matchingFiles.length > 1) {
      this.addLog(`Múltiples archivos encontrados: ${matchingFiles.join(', ')}`, 'error');
      return {
        success: false,
        error: 'MULTIPLE_FILES_FOUND',
        message: `Se encontraron ${matchingFiles.length} archivos coincidentes`,
        files: matchingFiles
      };
    }

    const selectedFile = matchingFiles[0];
    this.state.fileSelected = true;
    this.addLog(`Archivo seleccionado: ${selectedFile}`, 'success');

    return {
      success: true,
      file: selectedFile
    };
  }

  /**
   * Detectar archivo CSV
   */
  async detect(credentials) {
    try {
      this.logs = [];
      this.result = {
        status: 'PROCESSING',
        selectedFile: null,
        logs: []
      };

      this.addLog('Iniciando detección de archivos...', 'info');

      // 1. Validar credenciales
      const validation = this.validateCredentials(credentials);
      if (!validation.valid) {
        validation.errors.forEach(error => {
          this.addLog(error, 'error');
        });
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 2. Resolver ruta
      const pathResolution = this.resolvePath(credentials.path);
      if (!pathResolution.success) {
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 3. Conectar a SMB
      const connection = await this.connectToSMB({
        server: pathResolution.server,
        share: pathResolution.share,
        username: credentials.username,
        password: credentials.password,
        domain: credentials.domain
      });

      if (!connection.success) {
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 4. Listar archivos
      let files;
      try {
        this.addLog(`Accediendo a carpeta`, 'info');
        this.state.folderAccessible = true;
        this.addLog(`Carpeta accesible`, 'success');

        files = await this.listFilesInSMB(connection.client, pathResolution.subfolder);
        this.state.filesListed = true;
        this.addLog(`Archivos encontrados: ${files.length}`, 'success');
      } catch (error) {
        this.addLog(`Error accediendo a carpeta: ${error.message}`, 'error');
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 5. Aplicar patrón
      const matchingFiles = this.applyPattern(files, credentials.pattern);

      // 6. Seleccionar archivo
      const selection = this.selectFile(matchingFiles);

      if (!selection.success) {
        this.result.status = 'FAILED';
        this.result.error = selection.error;
        this.result.message = selection.message;
        this.result.files = selection.files;
        this.result.logs = this.logs;
        return this.result;
      }

      // Éxito
      this.result.status = 'READY';
      this.result.selectedFile = selection.file;
      this.result.logs = this.logs;

      this.addLog('Detección completada exitosamente', 'success');

      return this.result;

    } catch (error) {
      this.addLog(`Error inesperado: ${error.message}`, 'error');
      this.result.status = 'FAILED';
      this.result.error = 'UNEXPECTED_ERROR';
      this.result.message = error.message;
      this.result.logs = this.logs;
      return this.result;
    }
  }

  /**
   * Listar archivos sin patrón
   */
  async listFiles(credentials) {
    try {
      this.logs = [];
      this.addLog('Listando archivos...', 'info');

      // Validar
      const validation = this.validateCredentials(credentials);
      if (!validation.valid) {
        validation.errors.forEach(error => {
          this.addLog(error, 'error');
        });
        return {
          status: 'FAILED',
          logs: this.logs
        };
      }

      // Resolver ruta
      const pathResolution = this.resolvePath(credentials.path);
      if (!pathResolution.success) {
        return {
          status: 'FAILED',
          logs: this.logs
        };
      }

      // Conectar
      const connection = await this.connectToSMB({
        server: pathResolution.server,
        share: pathResolution.share,
        username: credentials.username,
        password: credentials.password,
        domain: credentials.domain
      });

      if (!connection.success) {
        return {
          status: 'FAILED',
          logs: this.logs
        };
      }

      // Listar
      const files = await this.listFilesInSMB(connection.client, pathResolution.subfolder);
      this.addLog(`Total de archivos: ${files.length}`, 'success');

      return {
        status: 'READY',
        files: files.map(f => ({
          name: f.filename,
          isDirectory: f.isDirectory,
          size: f.size,
          modified: f.lastWriteTime
        })),
        logs: this.logs
      };

    } catch (error) {
      this.addLog(`Error: ${error.message}`, 'error');
      return {
        status: 'FAILED',
        error: error.message,
        logs: this.logs
      };
    }
  }

  /**
   * Verificar conexión
   */
  async verifyConnection(credentials) {
    try {
      this.logs = [];
      this.addLog('Verificando conexión...', 'info');

      // Validar
      const validation = this.validateCredentials(credentials);
      if (!validation.valid) {
        validation.errors.forEach(error => {
          this.addLog(error, 'error');
        });
        return {
          status: 'FAILED',
          connected: false,
          logs: this.logs
        };
      }

      // Resolver ruta
      const pathResolution = this.resolvePath(credentials.path);
      if (!pathResolution.success) {
        return {
          status: 'FAILED',
          connected: false,
          logs: this.logs
        };
      }

      // Conectar
      const connection = await this.connectToSMB({
        server: pathResolution.server,
        share: pathResolution.share,
        username: credentials.username,
        password: credentials.password,
        domain: credentials.domain
      });

      if (!connection.success) {
        return {
          status: 'FAILED',
          connected: false,
          logs: this.logs
        };
      }

      this.addLog('Conexión verificada exitosamente', 'success');

      return {
        status: 'READY',
        connected: true,
        logs: this.logs
      };

    } catch (error) {
      this.addLog(`Error: ${error.message}`, 'error');
      return {
        status: 'FAILED',
        connected: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  /**
   * Exportar logs
   */
  exportLogs() {
    return this.logs
      .map(log => `[${log.timestamp}] ${log.prefix}`)
      .join('\n');
  }
}

export default SMB2FileDetector;
