/**
 * SMB Client - Frontend
 * 
 * Cliente que se comunica con el backend para acceder a SMB
 * Maneja llamadas HTTP a los endpoints del servidor
 */

class SMBClient {
  /**
   * Constructor
   * @param {string} baseURL - URL base del servidor (ej: http://localhost:3000)
   */
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.logs = [];
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
   * Hacer llamada HTTP
   */
  async request(endpoint, data) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      this.addLog(`Enviando solicitud a: ${endpoint}`, 'info');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.addLog(`Respuesta recibida`, 'success');

      return result;

    } catch (error) {
      this.addLog(`Error en solicitud: ${error.message}`, 'error');
      return {
        status: 'FAILED',
        error: 'REQUEST_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Detectar archivo CSV
   * @param {object} credentials - Credenciales
   * @returns {object} - Resultado
   */
  async detect(credentials) {
    try {
      this.logs = [];
      this.addLog('Iniciando detección...', 'info');

      // Validar entrada
      if (!credentials.path || !credentials.username || !credentials.password || !credentials.pattern) {
        this.addLog('Credenciales incompletas', 'error');
        return {
          status: 'FAILED',
          error: 'INVALID_CREDENTIALS',
          message: 'Faltan parámetros requeridos',
          logs: this.logs
        };
      }

      // Hacer solicitud
      const result = await this.request('/api/smb/detect', credentials);

      // Agregar logs del cliente
      result.logs = [...this.logs, ...(result.logs || [])];

      return result;

    } catch (error) {
      this.addLog(`Error: ${error.message}`, 'error');
      return {
        status: 'FAILED',
        error: 'CLIENT_ERROR',
        message: error.message,
        logs: this.logs
      };
    }
  }

  /**
   * Listar archivos
   * @param {object} credentials - Credenciales
   * @returns {object} - Resultado
   */
  async listFiles(credentials) {
    try {
      this.logs = [];
      this.addLog('Listando archivos...', 'info');

      if (!credentials.path || !credentials.username || !credentials.password) {
        this.addLog('Credenciales incompletas', 'error');
        return {
          status: 'FAILED',
          error: 'INVALID_CREDENTIALS',
          message: 'Faltan parámetros requeridos',
          logs: this.logs
        };
      }

      const result = await this.request('/api/smb/list', credentials);
      result.logs = [...this.logs, ...(result.logs || [])];

      return result;

    } catch (error) {
      this.addLog(`Error: ${error.message}`, 'error');
      return {
        status: 'FAILED',
        error: 'CLIENT_ERROR',
        message: error.message,
        logs: this.logs
      };
    }
  }

  /**
   * Verificar conexión
   * @param {object} credentials - Credenciales
   * @returns {object} - Resultado
   */
  async verify(credentials) {
    try {
      this.logs = [];
      this.addLog('Verificando conexión...', 'info');

      if (!credentials.path || !credentials.username || !credentials.password) {
        this.addLog('Credenciales incompletas', 'error');
        return {
          status: 'FAILED',
          error: 'INVALID_CREDENTIALS',
          message: 'Faltan parámetros requeridos',
          logs: this.logs
        };
      }

      const result = await this.request('/api/smb/verify', credentials);
      result.logs = [...this.logs, ...(result.logs || [])];

      return result;

    } catch (error) {
      this.addLog(`Error: ${error.message}`, 'error');
      return {
        status: 'FAILED',
        error: 'CLIENT_ERROR',
        message: error.message,
        logs: this.logs
      };
    }
  }

  /**
   * Verificar que el servidor está disponible
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      const data = await response.json();
      return {
        available: response.ok,
        data: data
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
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

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SMBClient;
}
