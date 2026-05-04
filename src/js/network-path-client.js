/**
 * Network Path Client - Frontend
 * 
 * Cliente real para comunicarse con el backend SMB
 * Llama al endpoint /test-connection con credenciales reales
 */

class NetworkPathClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.clientLogs = [];
  }

  /**
   * Add client log
   */
  addClientLog(message) {
    const timestamp = new Date().toISOString();
    this.clientLogs.push(`[${timestamp}] ${message}`);
    console.log(`[NetworkPathClient] ${message}`);
  }

  /**
   * Test connection and detect file
   * 
   * @param {Object} credentials
   * @param {string} credentials.path - UNC path (\\server\share\folder)
   * @param {string} credentials.pattern - File pattern (*.csv)
   * @param {string} credentials.username - Username (optional)
   * @param {string} credentials.password - Password (optional)
   * @param {string} credentials.domain - Domain (optional)
   * 
   * @returns {Promise<Object>} Result with status, file, and logs
   */
  async testConnection(credentials) {
    try {
      this.clientLogs = [];
      

      // Validar entrada
      if (!credentials.path || !credentials.pattern) {
        throw new Error('Path and pattern are required');
      }

      // Preparar payload
      const payload = {
        path: credentials.path,
        pattern: credentials.pattern,
        username: credentials.username || '',
        password: credentials.password || '',
        domain: credentials.domain || null
      };

      

      // Llamar al backend
      const response = await fetch(`${this.baseURL}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeout: 30000
      });

      if (!response.ok) {
        // Si es error 400, intentar obtener los logs del servidor
        if (response.status === 400) {
          try {
            const errorResult = await response.json();
            if (errorResult.logs && Array.isArray(errorResult.logs)) {
              return {
                status: 'FAILED',
                file: null,
                logs: [
                  ...this.clientLogs,
                  ...errorResult.logs
                ],
                clientLogs: this.clientLogs,
                serverLogs: errorResult.logs
              };
            }
          } catch (e) {
            // Si no se puede parsear, continuar con error generico
          }
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      

      // Combinar logs del cliente y del servidor
      const allLogs = result.logs || [];

      return {
        status: result.status,
        file: result.file,
        logs: allLogs,
        clientLogs: this.clientLogs,
        serverLogs: result.logs || []
      };

    } catch (error) {
      
      return {
        status: 'FAILED',
        file: null,
        logs: [`Error: ${error.message}`],
        error: error.message
      };
    }
  }

  /**
   * Get client logs
   */
  getClientLogs() {
    return this.clientLogs;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.clientLogs = [];
  }
}

// Export para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NetworkPathClient;
}
