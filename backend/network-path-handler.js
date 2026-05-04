/**
 * Network Path Handler - Backend SMB Module
 * 
 * Módulo que maneja:
 * - Conexión a rutas SMB
 * - Autenticación
 * - Listado de archivos
 * - Coincidencia de patrones
 * - Selección de archivo único
 * 
 * Sin lógica de UI, sin valores hardcodeados.
 */

import SMB2 from 'smb2';

class NetworkPathHandler {
  constructor() {
    this.logs = [];
  }

  /**
   * Agregar log sin exponer contraseñas
   */
  addLog(message) {
    this.logs.push(message);
    console.log(`[LOG] ${message}`);
  }

  /**
   * Convertir patrón wildcard a regex
   */
  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Parsear ruta UNC
   */
  parseUNCPath(path) {
    try {
      this.addLog('Resolving path...');

      // Normalizar separadores
      const normalized = path.replace(/\//g, '\\');

      // Validar formato UNC
      if (!normalized.startsWith('\\\\')) {
        throw new Error('Path must be UNC format (\\\\server\\share)');
      }

      // Parsear componentes
      const parts = normalized.split('\\').filter(p => p.length > 0);
      if (parts.length < 2) {
        throw new Error('Path must have at least server and share');
      }

      return {
        server: parts[0],
        share: parts[1],
        subfolder: parts.slice(2).join('\\')
      };
    } catch (error) {
      throw new Error(`Cannot resolve path: ${error.message}`);
    }
  }

  /**
   * Construir usuario con dominio
   */
  buildUsername(username, domain) {
    if (domain && domain.trim()) {
      return `${domain}\\${username}`;
    }
    return username;
  }

  /**
   * Conectar a SMB
   */
  async connectToSMB(server, share, username, password) {
    try {
      this.addLog('Connecting to network share...');

      const client = new SMB2({
        host: server,
        username: username,
        password: password,
        share: share
      });

      this.addLog('Authentication successful');
      return client;
    } catch (error) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error('Connection failed: Server not reachable');
      } else if (error.message.includes('EACCES')) {
        throw new Error('Authentication failed: Invalid credentials');
      } else {
        throw new Error(`Connection failed: ${error.message}`);
      }
    }
  }

  /**
   * Acceder a carpeta
   */
  async accessFolder(client, subfolder) {
    try {
      this.addLog('Accessing folder...');

      const folderPath = subfolder ? `\\${subfolder}` : '\\';

      return new Promise((resolve, reject) => {
        client.readdir(folderPath, (error, files) => {
          if (error) {
            if (error.message.includes('ENOENT')) {
              reject(new Error('Folder not found'));
            } else if (error.message.includes('EACCES')) {
              reject(new Error('Access denied'));
            } else {
              reject(new Error(`Cannot access folder: ${error.message}`));
            }
          } else {
            this.addLog('Folder accessible');
            resolve(files || []);
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Listar archivos
   */
  listFiles(files) {
    const fileList = files
      .filter(f => !f.isDirectory)
      .map(f => f.filename);

    this.addLog(`Files found: ${fileList.length}`);
    return fileList;
  }

  /**
   * Aplicar patrón
   */
  applyPattern(files, pattern) {
    const regex = this.patternToRegex(pattern);
    const matching = files.filter(f => regex.test(f));

    this.addLog(`Matching files: ${matching.length}`);
    return matching;
  }

  /**
   * Seleccionar archivo
   */
  selectFile(files) {
    if (files.length === 0) {
      throw new Error('File not found');
    }

    if (files.length > 1) {
      throw new Error(`Multiple files found: ${files.join(', ')}`);
    }

    const selected = files[0];
    this.addLog(`File selected: ${selected}`);
    return selected;
  }

  /**
   * Ejecutar detección completa
   */
  async detect(credentials) {
    try {
      this.logs = [];

      // Validar entrada
      if (!credentials.path || !credentials.username || !credentials.password || !credentials.pattern) {
        throw new Error('Missing required credentials');
      }

      // 1. Parsear ruta
      const parsed = this.parseUNCPath(credentials.path);

      // 2. Construir usuario
      const user = this.buildUsername(credentials.username, credentials.domain);

      // 3. Conectar
      const client = await this.connectToSMB(
        parsed.server,
        parsed.share,
        credentials.username,
        credentials.password
      );

      // 4. Acceder a carpeta
      const files = await this.accessFolder(client, parsed.subfolder);

      // 5. Listar archivos
      const fileList = this.listFiles(files);

      // 6. Aplicar patrón
      const matching = this.applyPattern(fileList, credentials.pattern);

      // 7. Seleccionar archivo
      const selected = this.selectFile(matching);

      return {
        status: 'READY',
        file: selected,
        logs: this.logs
      };

    } catch (error) {
      this.addLog(`Error: ${error.message}`);
      return {
        status: 'FAILED',
        file: null,
        logs: this.logs
      };
    }
  }
}

export default NetworkPathHandler;
