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
  constructor() {
    this.logs = [];
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
    const escapedPath = path.replace(/"/g, '\\"').replace(/'/g, "''");
    
    // If no credentials, use simple command
    if (!credentials.username || !credentials.password) {
      return `powershell -Command "Get-ChildItem -Path '${escapedPath}' -File | Select-Object Name | ConvertTo-Json"`;
    }

    // Build credential object for PowerShell
    const escapedUsername = credentials.username.replace(/"/g, '\\"');
    const escapedPassword = credentials.password.replace(/"/g, '\\"');
    
    let credentialCommand = `$secPassword = ConvertTo-SecureString '${escapedPassword}' -AsPlainText -Force; `;
    
    // If domain is specified, use domain\\username format
    if (credentials.domain) {
      const escapedDomain = credentials.domain.replace(/"/g, '\\"');
      credentialCommand += `$cred = New-Object System.Management.Automation.PSCredential('${escapedDomain}\\${escapedUsername}', $secPassword); `;
    } else {
      credentialCommand += `$cred = New-Object System.Management.Automation.PSCredential('${escapedUsername}', $secPassword); `;
    }

    credentialCommand += `Get-ChildItem -Path '${escapedPath}' -File -Credential $cred | Select-Object Name | ConvertTo-Json`;

    return `powershell -Command "${credentialCommand}"`;
  }

  /**
   * List files via PowerShell
   */
  async listFilesViaPS(path, credentials) {
    try {
      this.addLog('Accessing folder via PowerShell...');

      // Build command with credentials
      const psCommand = this.buildPowerShellCommand(path, credentials);

      this.addLog(`Connecting with credentials: ${credentials.username ? 'Yes' : 'No'}`);
      if (credentials.domain) {
        this.addLog(`Domain: ${credentials.domain}`);
      }

      const { stdout, stderr } = await execAsync(psCommand, { timeout: 10000 });

      if (stderr && !stderr.includes('Warning')) {
        throw new Error(stderr);
      }

      // Parse JSON
      let files = [];
      if (stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout);
          files = Array.isArray(parsed) ? parsed.map(f => f.Name) : [parsed.Name];
        } catch (e) {
          this.addLog('Warning: Could not parse file list');
          files = [];
        }
      }

      this.addLog('Folder accessible');
      this.addLog(`Files found: ${files.length}`);

      return files;
    } catch (error) {
      if (error.message.includes('cannot find path')) {
        throw new Error(
          'FOLDER NOT FOUND\n' +
          'The path does not exist or is not accessible.\n' +
          'Verify:\n' +
          '1. Path is correct: \\\\server\\share\\folder\n' +
          '2. Server is online and reachable\n' +
          '3. Shared folder exists\n' +
          '4. You have network access to this location'
        );
      } else if (error.message.includes('Access is denied')) {
        throw new Error(
          'ACCESS DENIED\n' +
          'You do not have permission to access this folder.\n' +
          'Verify:\n' +
          '1. Username and password are correct\n' +
          '2. User has read permissions on the folder\n' +
          '3. Domain is correct (if using domain authentication)\n' +
          '4. Try with different credentials'
        );
      } else if (error.message.includes('The user name or password is incorrect')) {
        throw new Error(
          'AUTHENTICATION FAILED\n' +
          'Username or password is incorrect.\n' +
          'Verify:\n' +
          '1. Username is correct\n' +
          '2. Password is correct\n' +
          '3. Domain is correct (if using domain authentication)\n' +
          '4. Account is not locked or disabled'
        );
      } else {
        throw new Error(
          'CANNOT ACCESS FOLDER\n' +
          `Error: ${error.message}\n` +
          'Verify:\n' +
          '1. Network connection is active\n' +
          '2. Path format is correct\n' +
          '3. Server is reachable (try ping)\n' +
          '4. Firewall is not blocking SMB (port 445)'
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

      let psCommand = `Get-Content -Path '${fullPath}' -Raw -Encoding UTF8`;

      if (username && password) {
        const secPassword = `ConvertTo-SecureString '${password}' -AsPlainText -Force`;
        const credFormat = domain ? `${domain}\\${username}` : username;
        const cred = `New-Object System.Management.Automation.PSCredential('${credFormat}', (${secPassword}))`;
        psCommand = `$cred = ${cred}; Get-Content -Path '${fullPath}' -Raw -Encoding UTF8 -Credential $cred`;
      }

      const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand}"`);

      if (stderr) {
        throw new Error(stderr);
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
