/**
 * Network Path Handler - Windows Implementation
 * 
 * Usa PowerShell para acceder a rutas SMB en Windows
 * Soporta autenticación con usuario/contraseña/dominio
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class NetworkPathHandlerWindows {
  constructor(credentialCrypto = null) {
    this.logs = [];
    this.credentialCrypto = credentialCrypto;
  }

  /**
   * Add log
   */
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
   * Validate UNC path
   */
  validatePath(path) {
    if (!path.startsWith('\\\\')) {
      throw new Error(
        'INVALID PATH FORMAT\n' +
        'Expected UNC format: \\\\\\server\\share\\folder\n' +
        'Example: \\\\192.168.1.100\\compartida\\archivos\n' +
        'Your input: ' + path
      );
    }
    return true;
  }

  /**
   * Build PowerShell command with credentials
   */
	buildPowerShellCommand(path, credentials) {
	  const escapedPath = path.replace(/"/g, '\\"');

	  // SIN credenciales
	  if (!credentials.username || !credentials.password) {
		return `cmd /c dir ${escapedPath}`;
	  }

	  // CON credenciales — incluir dominio igual que readFile (DOMINIO\usuario)
	  const credFormat = credentials.domain
	    ? `${credentials.domain}\\${credentials.username}`
	    : credentials.username;
	  return `cmd /c "net use ${escapedPath} /delete /y & net use ${escapedPath} /user:${credFormat} ${credentials.password} && dir ${escapedPath}"`;
	}

  /**
   * List files via PowerShell
   */
  async listFilesViaPS(path, credentials) {
    try {
      this.addLog('Accessing folder via PowerShell...');

      // Build command with credentials
      const psCommand = this.buildPowerShellCommand(path, credentials);
	  //this.addLog(`PS COMMAND: ${psCommand}`);
      this.addLog(`Connecting with credentials: ${credentials.username ? 'Yes' : 'No'}`);
      if (credentials.domain) {
        this.addLog(`Domain: ${credentials.domain}`);
      }

      const { stdout, stderr } = await execAsync(psCommand, { timeout: 10000 });
	  //this.addLog(`STDOUT: ${stdout}`);
	  //this.addLog(`STDERR: ${stderr}`);
	  //this.addLog(`RAW OUTPUT: ${stdout}`);
      if (stderr && !stderr.includes('Warning')) {
        throw new Error(stderr);
      }

      let files = [];

		if (stdout) {
		  const lines = stdout.split('\n');

			files = lines
				.map(line => line.trim())
				.filter(line => {
				  // Skip empty lines
				  if (!line.length) return false;
				  
				  // Skip header/summary lines
				  if (line.startsWith('Volume') || 
				      line.startsWith('Directory') ||
				      line.startsWith('File(s)') ||
				      line.startsWith('Dir(s)') ||
				      line.startsWith('Serial')) return false;
				  
				  // Skip directory entries (folders, . and ..) — they also start with a date but show <DIR>
				  if (line.includes('<DIR>')) return false;
				  if (line.trim() === '.' || line.trim() === '..') return false;
				  
				  // File lines start with date (DD/MM/YYYY or MM/DD/YYYY)
				  // Format: 08/05/2026 05:08          15.797 Filename
				  if (!/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(line)) return false;
				  
				  return true;
			})
			.map(line => {
			  // Extract filename from: 08/05/2026 05:08          15.797 Filename
			  // Split by whitespace, take everything from index 3 onwards
			  const parts = line.split(/\s+/);
			  
			  // Take everything from index 3 onwards (handles filenames with spaces)
			  if (parts.length > 3) {
				return parts.slice(3).join(' ');
			  }
			  return null;
			})
			.filter(file => file && file.length > 0);
		}

      this.addLog('Folder accessible');
      this.addLog(`Files found: ${files.length}`);
	  //this.addLog(`Files detected: ${JSON.stringify(files)}`);
	  
      return files;
    } catch (error) {
		const msg = error.message.toLowerCase();

		// Auth disabled + the folder rejected the (anonymous/process) identity →
		// tell the operator clearly that credentials are needed.
		const noCreds = !credentials.username || !credentials.password;
		const authError =
		  msg.includes('user name or password') ||
		  msg.includes('nombre de usuario o la contraseña') ||
		  msg.includes('access is denied') ||
		  msg.includes('acceso denegado') ||
		  msg.includes('system error 5') ||
		  msg.includes('error de sistema 5');
		if (noCreds && authError) {
		  throw new Error(
			'FOLDER REQUIRES CREDENTIALS<br>' +
			'This shared folder requires authentication.<br>' +
			'Enable "Authentication" and enter a valid username and password.'
		  );
		}

		if (msg.includes('system error 67')) {
		  throw new Error(
			'SERVER NOT REACHABLE<br>' +
			'Cannot connect to the network share.<br><br>' +
			'Suggestions:<br>' +
			'• Ensure the server is powered on<br>' +
			'• Check the network connection<br>' +
			'• Verify the path is correct (\\\\server\\share)<br>' +
			'• Try pinging the server'
		  );
		}
      else if (msg.includes('cannot find path')) {
        throw new Error(
          'FOLDER NOT FOUND<br>' +
          'The path does not exist or is not accessible.<br>' +
          'Verify:<br>' +
          '1. Path is correct: \\\\server\\share\\folder<br>' +
          '2. Server is online and reachable<br>' +
          '3. Shared folder exists<br>' +
          '4. You have network access to this location'
        );
      } else if (msg.includes('Access is denied')) {
        throw new Error(
          'ACCESS DENIED<br>' +
          'You do not have permission to access this folder.<br>' +
          'Verify:<br>' +
          '1. Username and password are correct<br>' +
          '2. User has read permissions on the folder<br>' +
          '3. Domain is correct (if using domain authentication)<br>' +
          '4. Try with different credentials'
        );
      } else if (msg.includes('The user name or password is incorrect')) {
        throw new Error(
          'AUTHENTICATION FAILED<br>' +
          'Username or password is incorrect.<br>' +
          'Verify:<br>' +
          '1. Username is correct<br>' +
          '2. Password is correct<br>' +
          '3. Domain is correct (if using domain authentication)<br>' +
          '4. Account is not locked or disabled'
        );
      } else if (msg.includes('system error 64')) {
		  throw new Error(
			'CONNECTION LOST<br>' +
			'The connection to the network share was interrupted.<br><br>' +
			'Suggestions:<br>' +
			'• Check network stability<br>' +
			'• Ensure the server is still online<br>' +
			'• Try again in a few seconds<br>' +
			'• Verify no VPN/firewall is interrupting the connection'
		  );
		} else if (msg.includes('access is denied')) {
		  throw new Error(
			'ACCESS DENIED<br>' +
			'You do not have permission to access the shared folder.<br><br>' +
			'Suggestions:<br>' +
			'• Verify username and password<br>' +
			'• Ensure the user has read access to the shared folder<br>' +
			'• Check share permissions on the server<br>' +
			'• Try accessing the folder manually from Windows'
		  );
		}else {
        throw new Error(
          'CANNOT ACCESS FOLDER<br>' +
          `Error: ${error.message}<br>` +
          'Verify:<br>' +
          '1. Network connection is active<br>' +
          '2. Path format is correct<br>' +
          '3. Server is reachable (try ping)<br>' +
          '4. Username or/and password is incorrect'
        );
      }
    }
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
      throw new Error(
        'NO FILES FOUND\n' +
        'No files match the pattern in this folder.\n' +
        'Verify:\n' +
        '1. Pattern is correct (use wildcards: *.csv, file_*.csv)\n' +
        '2. Files exist in the folder\n' +
        '3. File extension matches the pattern\n' +
        '4. Try a more generic pattern (e.g., *.csv instead of specific_*.csv)'
      );
    }

    if (files.length > 1) {
      throw new Error(
        `MULTIPLE FILES FOUND (${files.length})\n` +
        `Files: ${files.join(', ')}\n` +
        'Expected exactly 1 file.\n' +
        'Verify:\n' +
        '1. Make pattern more specific\n' +
        '2. Add date or version to pattern (e.g., medications_202605*.csv)\n' +
        '3. Check if old files should be archived'
      );
    }

    const selected = files[0];
    this.addLog(`File selected: ${selected}`);
    return selected;
  }

  /**
   * Read file content
   */
  async readFile(options) {
    try {
      const { path, filename, username, password, domain } = options;
      const fullPath = `${path}\\${filename}`;

      this.addLog(`Reading file: ${fullPath}`);

      let command = '';

      if (username && password) {
        // Use net use to mount the share, then read the file
        // Silence net use output completely to avoid mixing with file content
        const credFormat = domain ? `${domain}\\${username}` : username;
        command = `cmd /c "net use ${path} /delete /y >nul 2>&1 & net use ${path} /user:${credFormat} ${password} >nul 2>&1 & type \"${fullPath}\""`;
        this.addLog(`Mounting share with credentials: ${credFormat}`);
      } else {
        // Read file without credentials
        command = `cmd /c type "${fullPath}"`;
      }

      const { stdout, stderr } = await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });

      if (stderr && stderr.trim()) {
        this.addLog(`Warning: ${stderr}`);
      }

      this.addLog(`File read successfully: ${filename}`);
      return stdout;

    } catch (error) {
      this.addLog(`Error reading file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute complete detection
   */
  async detect(credentials) {
    try {
      this.logs = [];

      // Decrypt password if encrypted and credentialCrypto is available
      if (this.credentialCrypto && credentials.password) {
        try {
          this.addLog('Decrypting password...');
          credentials.password = await this.credentialCrypto.decrypt(credentials.password);
          this.addLog('Password decrypted successfully');
        } catch (error) {
          this.addLog(`Decryption error: ${error.message}`);
          throw error;
        }
      }

      // Validate input
      if (!credentials.path || !credentials.pattern) {
        throw new Error(
          'MISSING REQUIRED FIELDS\n' +
          'Please fill in:\n' +
          `1. Path: ${credentials.path ? '✓' : '✗ Required'}\n` +
          `2. File Name Pattern: ${credentials.pattern ? '✓' : '✗ Required'}\n` +
          'Example:\n' +
          'Path: \\\\server\\compartida\\archivos\n' +
          'Pattern: medications_*.csv'
        );
      }

      this.addLog('Resolving path...');

      // Validate path
      this.validatePath(credentials.path);

      this.addLog('Connecting to network share...');

      // List files with credentials
      const files = await this.listFilesViaPS(credentials.path, credentials);

      // Apply pattern
      const matching = this.applyPattern(files, credentials.pattern);

      // Select file
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

export default NetworkPathHandlerWindows;
