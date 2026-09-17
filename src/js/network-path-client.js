/**
 * Network Path Client - Frontend
 *
 * Cliente para comunicarse con el backend SMB
 * Llama al endpoint /test-connection con credenciales reales
 */

const TEST_CONNECTION_TIMEOUT_MS = 60000;

class NetworkPathClient {
  // Sin URL base: mismo origen que la página (funciona con cualquier PORT o host)
  constructor(baseURL = '') {
    this.baseURL = baseURL;
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
      if (!credentials.path || !credentials.pattern) {
        throw new Error('Path and pattern are required');
      }

      const payload = {
        path: credentials.path,
        pattern: credentials.pattern,
        username: credentials.username || '',
        password: credentials.password || '',
        domain: credentials.domain || null
      };

      const response = await fetch(`${this.baseURL}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS)
      });

      const result = await response.json().catch(() => null);

      // El backend devuelve logs también en errores (400/500)
      if (result && Array.isArray(result.logs)) {
        return {
          status: response.ok ? result.status : 'FAILED',
          file: response.ok ? result.file : null,
          logs: result.logs
        };
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const message = error.name === 'TimeoutError'
        ? `No response after ${TEST_CONNECTION_TIMEOUT_MS / 1000} s`
        : error.message;
      return {
        status: 'FAILED',
        file: null,
        logs: [`Error: ${message}`],
        error: message
      };
    }
  }
}
