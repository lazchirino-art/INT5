/**
 * SMB Network Path File Detector
 * 
 * Módulo genérico para acceder a rutas de red (SMB), listar archivos
 * y detectar un CSV basado en un patrón configurable.
 * 
 * CARACTERÍSTICAS:
 * - Conexión a rutas de red compartidas
 * - Soporte para autenticación con dominio opcional
 * - Listado de archivos dinámico
 * - Coincidencia de patrones (exacto y wildcard)
 * - Validación paso a paso
 * - Logs detallados para debugging
 * - Manejo robusto de errores
 */

class SMBFileDetector {
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
   * @param {string} message - Mensaje de log
   * @param {string} type - Tipo: 'info', 'success', 'error', 'warning'
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
   * Validar entrada de credenciales
   * @param {object} credentials - Credenciales
   * @returns {object} - Resultado de validación
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

    if (!credentials.pattern || typeof credentials.pattern !== 'string') {
      errors.push('Pattern no válido o no proporcionado');
    }

    // Domain es opcional
    if (credentials.domain && typeof credentials.domain !== 'string') {
      errors.push('Domain debe ser un string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Resolver y normalizar la ruta
   * @param {string} path - Ruta a resolver
   * @returns {object} - Ruta resuelta
   */
  resolvePath(path) {
    try {
      this.addLog(`Resolviendo ruta: ${path}`, 'info');

      // Validar que sea una ruta UNC válida
      if (!path.startsWith('\\\\') && !path.startsWith('//')) {
        throw new Error('La ruta debe ser una ruta UNC (\\\\servidor\\compartida)');
      }

      // Normalizar separadores
      const normalizedPath = path.replace(/\//g, '\\');

      // Validar estructura mínima
      const parts = normalizedPath.split('\\').filter(p => p.length > 0);
      if (parts.length < 2) {
        throw new Error('La ruta UNC debe tener al menos servidor y compartida');
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
   * Construir credencial de usuario con dominio
   * @param {string} username - Nombre de usuario
   * @param {string} domain - Dominio (opcional)
   * @returns {string} - Usuario formateado
   */
  buildUserCredential(username, domain) {
    if (domain && domain.trim().length > 0) {
      return `${domain}\\${username}`;
    }
    return username;
  }

  /**
   * Simular conexión a red (en navegador, esto es una abstracción)
   * @param {object} params - Parámetros de conexión
   * @returns {object} - Resultado de conexión
   */
  async connectToNetwork(params) {
    try {
      this.addLog(`Conectando a recurso compartido: ${params.path}`, 'info');

      // En un entorno real, aquí se usaría una librería como:
      // - jCIFS (para Java)
      // - node-smb2 (para Node.js)
      // - Samba (para sistemas Linux)
      // - Windows API (para Windows)

      // Para este POC en navegador, simulamos la conexión
      // En producción, esto sería un endpoint backend

      const userCredential = this.buildUserCredential(params.username, params.domain);

      this.addLog(`Autenticando como: ${userCredential}`, 'info');

      // Simular validación de credenciales
      if (!params.username || !params.password) {
        throw new Error('Credenciales inválidas');
      }

      this.state.connected = true;
      this.addLog(`Conexión exitosa a: ${params.path}`, 'success');

      this.state.authenticated = true;
      this.addLog(`Autenticación exitosa`, 'success');

      return {
        success: true,
        connected: true,
        authenticated: true
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
   * Verificar acceso a carpeta
   * @param {object} params - Parámetros
   * @returns {object} - Resultado
   */
  async verifyFolderAccess(params) {
    try {
      this.addLog(`Verificando acceso a carpeta: ${params.path}`, 'info');

      // En un entorno real, aquí se verificaría el acceso real
      // Para este POC, simulamos que siempre es accesible

      this.state.folderAccessible = true;
      this.addLog(`Carpeta accesible`, 'success');

      return {
        success: true,
        accessible: true
      };
    } catch (error) {
      this.addLog(`Error verificando acceso: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convertir patrón wildcard a expresión regular
   * @param {string} pattern - Patrón (ej: data_*.csv)
   * @returns {RegExp} - Expresión regular
   */
  patternToRegex(pattern) {
    // Escapar caracteres especiales excepto *
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    // Anclar al inicio y final
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Listar archivos (simulado para POC)
   * @param {object} params - Parámetros
   * @returns {object} - Resultado
   */
  async listFiles(params) {
    try {
      this.addLog(`Listando archivos en: ${params.path}`, 'info');

      // En un entorno real, aquí se listarían los archivos reales
      // Para este POC, retornamos un array vacío
      // El backend real proporcionaría la lista

      const files = [];

      this.state.filesListed = true;
      this.addLog(`Archivos encontrados: ${files.length}`, 'success');

      return {
        success: true,
        files: files,
        count: files.length
      };
    } catch (error) {
      this.addLog(`Error listando archivos: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Aplicar patrón a lista de archivos
   * @param {array} files - Lista de archivos
   * @param {string} pattern - Patrón
   * @returns {array} - Archivos coincidentes
   */
  applyPattern(files, pattern) {
    try {
      this.addLog(`Aplicando patrón: ${pattern}`, 'info');

      const regex = this.patternToRegex(pattern);
      const matchingFiles = files.filter(file => regex.test(file));

      this.addLog(`Archivos coincidentes: ${matchingFiles.length}`, 'info');

      return matchingFiles;
    } catch (error) {
      this.addLog(`Error aplicando patrón: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Seleccionar archivo basado en reglas
   * @param {array} matchingFiles - Archivos coincidentes
   * @returns {object} - Resultado de selección
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
   * Ejecutar detección completa
   * @param {object} credentials - Credenciales
   * @returns {object} - Resultado final
   */
  async detect(credentials) {
    try {
      // Resetear estado
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

      // 3. Conectar a red
      const connection = await this.connectToNetwork({
        path: credentials.path,
        username: credentials.username,
        password: credentials.password,
        domain: credentials.domain
      });

      if (!connection.success) {
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 4. Verificar acceso a carpeta
      const folderAccess = await this.verifyFolderAccess({
        path: credentials.path
      });

      if (!folderAccess.success) {
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 5. Listar archivos
      const fileList = await this.listFiles({
        path: credentials.path
      });

      if (!fileList.success) {
        this.result.status = 'FAILED';
        this.result.logs = this.logs;
        return this.result;
      }

      // 6. Aplicar patrón
      const matchingFiles = this.applyPattern(fileList.files, credentials.pattern);

      // 7. Seleccionar archivo
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
   * Obtener resumen de estado
   * @returns {object} - Resumen
   */
  getStateSummary() {
    return {
      state: this.state,
      result: this.result,
      logs: this.logs
    };
  }

  /**
   * Exportar logs como string
   * @returns {string} - Logs formateados
   */
  exportLogs() {
    return this.logs
      .map(log => `[${log.timestamp}] ${log.prefix}`)
      .join('\n');
  }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SMBFileDetector;
}
