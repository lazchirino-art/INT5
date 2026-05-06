// Connection test state (REMOVED - now uses real backend)
// const networkConnectionTestState = { ... };

const sftpConnectionTestState = {
    hostResolved: true,
    serverConnected: true,
    authenticated: true,
    remotePathAccessible: true,
    fileCheckError: false,
    matchedFileCount: 1
};

const logIcon = {
    success: '✓',
    error: '✗',
    warning: '⚠'
};

const connectionStorageKey = 'menuCsvInt.connectionConfig';

// Client to connect with backend
let networkPathClient = null;

function initializeNetworkPathClient() {
    if (!networkPathClient) {
        networkPathClient = new NetworkPathClient('http://localhost:3000');
    }
    return networkPathClient;
}

function openTab(index) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    tabs[index].classList.add('active');
    contents[index].classList.add('active');
}

function handleConnectionTypeChange() {
    const connectionType = document.getElementById('connectionType').value;
    const networkPathFields = document.getElementById('networkPathFields');
    const sftpFields = document.getElementById('sftpFields');
    const connectionLog = document.getElementById('connectionLog');

    networkPathFields.classList.toggle('active', connectionType === 'networkPath');
    sftpFields.classList.toggle('active', connectionType === 'sftp');
    connectionLog.classList.toggle('active', connectionType !== '');
    resetConnectionLog();
    setSaveButtonsEnabled(false);

    if (connectionType === 'sftp') {
        handleSftpAuthTypeChange();
    }
}

function toggleOptionalField(checkboxId, fieldId) {
    const checkbox = document.getElementById(checkboxId);
    const field = document.getElementById(fieldId);

    field.disabled = !checkbox.checked;

    if (!checkbox.checked) {
        field.value = '';
    }
}

function toggleAuthenticationFields() {
    const authenticationEnabled = document.getElementById('useNetworkAuthentication').checked;
    const username = document.getElementById('networkUsername');
    const password = document.getElementById('networkPassword');

    username.disabled = !authenticationEnabled;
    password.disabled = !authenticationEnabled;

    if (!authenticationEnabled) {
        username.value = '';
        password.value = '';
    }
}

function handleSftpAuthTypeChange() {
    const authType = document.getElementById('sftpAuthType').value;
    const passwordGroup = document.getElementById('sftpPasswordGroup');
    const privateKeyGroup = document.getElementById('sftpPrivateKeyGroup');
    const passphraseGroup = document.getElementById('sftpPassphraseGroup');
    const password = document.getElementById('sftpPassword');
    const privateKey = document.getElementById('sftpPrivateKey');
    const passphrase = document.getElementById('sftpPassphrase');

    passwordGroup.classList.toggle('active', authType === 'password');
    privateKeyGroup.classList.toggle('active', authType === 'privateKey');
    passphraseGroup.classList.toggle('active', authType === 'privateKey');

    password.disabled = authType !== 'password';
    privateKey.disabled = authType !== 'privateKey';
    passphrase.disabled = authType !== 'privateKey';

    if (authType === 'password') {
        privateKey.value = '';
        passphrase.value = '';
    } else {
        password.value = '';
    }
}

function getNetworkConnectionConfig() {
    return {
        connectorType: 'networkPath',
        type: 'Network Path',
        path: document.getElementById('networkPath').value.trim(),
        fileNamePattern: document.getElementById('networkFileNamePattern').value.trim(),
        useAuthentication: document.getElementById('useNetworkAuthentication').checked,
        username: document.getElementById('networkUsername').value.trim(),
        password: document.getElementById('networkPassword').value,
        useDomain: document.getElementById('useNetworkDomain').checked,
        domain: document.getElementById('networkDomain').value.trim()
    };
}

/**
 * Validate Network Path configuration
 * Returns {valid: boolean, errors: string[]}
 */
function validateNetworkConnectionConfig(config) {
    const errors = [];

    // Required fields
    if (!config.path) {
        errors.push('Path is required');
    }

    if (!config.fileNamePattern) {
        errors.push('File Name Pattern is required');
    }

    // Conditional required fields
    if (config.useAuthentication) {
        if (!config.username) {
            errors.push('Username is required when Authentication is enabled');
        }
        if (!config.password) {
            errors.push('Password is required when Authentication is enabled');
        }
    }

    if (config.useDomain) {
        if (!config.domain) {
            errors.push('Domain is required when Domain option is enabled');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Test Network Path connection REAL
 * Calls backend that executes PowerShell to access SMB
 */
async function testNetworkConnection() {
    const config = getNetworkConnectionConfig();
    const lines = [];
    let status = 'READY';

    // Frontend validation - block before API call
    const validation = validateNetworkConnectionConfig(config);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            lines.push(createLogLine('error', error));
        });
        renderConnectionLog(lines, 'FAILED');
        setSaveButtonsEnabled(false);
        return;
    }

    lines.push(createPlainLogLine('Connecting to SMB server...'));

    try {
        // Show connecting status
        renderConnectionLog([createPlainLogLine('Connecting to SMB server...')], 'TESTING');

        // Initialize client
        const client = initializeNetworkPathClient();

        // Prepare credentials
        const credentials = {
            path: config.path,
            pattern: config.fileNamePattern,
            username: config.useAuthentication ? config.username : '',
            password: config.useAuthentication ? config.password : '',
            domain: config.useDomain ? config.domain : null
        };

        // Call real backend
        const result = await client.testConnection(credentials);

        // Process backend logs
        const backendLines = (result.logs || []).map(log => {
            let type = 'plain';
            
            // Detect log type by content
            if (log.toLowerCase().includes('error') || 
                log.toLowerCase().includes('failed') || 
                log.toLowerCase().includes('denied') ||
                log.toLowerCase().includes('✗')) {
                type = 'error';
            } else if (log.toLowerCase().includes('success') || 
                       log.toLowerCase().includes('found') || 
                       log.toLowerCase().includes('selected') ||
                       log.toLowerCase().includes('✓')) {
                type = 'success';
            } else if (log.toLowerCase().includes('warning') || 
                       log.toLowerCase().includes('no files') ||
                       log.toLowerCase().includes('⚠')) {
                type = 'warning';
            }
            
            return { type, text: log };
        });

        // Render result
        renderConnectionLog(backendLines, result.status);
        setSaveButtonsEnabled(result.status === 'READY');

    } catch (error) {
        console.error('Error in testNetworkConnection:', error);
        lines.push(createLogLine('error', `Connection error: ${error.message}`));
        renderConnectionLog(lines, 'FAILED');
        setSaveButtonsEnabled(false);
    }
}

function getSftpConnectionConfig() {
    const authType = document.getElementById('sftpAuthType').value;

    return {
        connectorType: 'sftp',
        type: 'SFTP',
        host: document.getElementById('sftpHost').value.trim(),
        port: Number(document.getElementById('sftpPort').value || 22),
        username: document.getElementById('sftpUsername').value.trim(),
        authType,
        password: authType === 'password' ? document.getElementById('sftpPassword').value : '',
        privateKey: authType === 'privateKey' ? document.getElementById('sftpPrivateKey').value.trim() : '',
        passphrase: authType === 'privateKey' ? document.getElementById('sftpPassphrase').value : '',
        remotePath: document.getElementById('sftpRemotePath').value.trim(),
        fileNamePattern: document.getElementById('sftpFileNamePattern').value.trim()
    };
}

function getCurrentConnectionConfig() {
    const connectionType = document.getElementById('connectionType').value;

    if (connectionType === 'networkPath') {
        return getNetworkConnectionConfig();
    }

    if (connectionType === 'sftp') {
        return getSftpConnectionConfig();
    }

    throw new Error('Connection Type is required');
}

async function getCurrentConnectionConfigForStorage() {
    const config = getCurrentConnectionConfig();

    return CredentialCrypto.prepareConnectionConfigForStorage(config);
}

async function getConnectionConfigForRuntime(storedConfig) {
    return CredentialCrypto.prepareConnectionConfigForRuntime(storedConfig);
}

async function saveCurrentConnectionConfig() {
    setSaveStatus('saving', 'SAVE: SAVING...');

    try {
        const storedConfig = await getCurrentConnectionConfigForStorage();
        const appConfig = {
            connection: storedConfig
        };

        await persistConfiguration(appConfig);
        setSaveStatus('saved', 'SAVE: SAVED');
    } catch (error) {
        setSaveStatus('failed', 'SAVE: SAVE ERROR');
        renderConnectionLog([createLogLine('error', error.message)], 'FAILED');
    }
}

async function loadStoredConnectionConfigForRuntime() {
    const appConfig = await loadPersistedConfiguration();

    if (!appConfig?.connection) {
        return null;
    }

    return getConnectionConfigForRuntime(appConfig.connection);
}

async function persistConfiguration(config) {
    // Intentar guardar en backend API primero
    try {
        console.log('[persistConfiguration] Saving to backend API...');
        const response = await fetch('/api/config/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('[persistConfiguration] Configuration saved to backend:', data);
            return;
        } else {
            console.warn('[persistConfiguration] Backend API error:', response.status);
        }
    } catch (error) {
        console.error('[persistConfiguration] Error saving to backend API:', error);
    }
    
    // Fallback: Guardar en AppConfigStore si está disponible
    if (window.AppConfigStore?.saveConfig) {
        console.log('[persistConfiguration] Falling back to AppConfigStore');
        await window.AppConfigStore.saveConfig(config);
        return;
    }

    // Final fallback: Guardar en localStorage
    console.log('[persistConfiguration] Falling back to localStorage');
    localStorage.setItem(connectionStorageKey, JSON.stringify(config));
}

async function loadPersistedConfiguration() {
    // Intentar cargar desde backend API primero
    try {
        console.log('[loadPersistedConfiguration] Loading from backend API...');
        const response = await fetch('/api/config/load');
        
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'SUCCESS' && data.config) {
                console.log('[loadPersistedConfiguration] Configuration loaded from backend');
                return data.config;
            }
            if (data.status === 'NOT_FOUND') {
                console.log('[loadPersistedConfiguration] No configuration found in backend');
            }
        } else {
            console.warn('[loadPersistedConfiguration] Backend API error:', response.status);
        }
    } catch (error) {
        console.error('[loadPersistedConfiguration] Error loading from backend API:', error);
    }
    
    // Fallback: Cargar desde AppConfigStore si está disponible
    try {
        if (window.AppConfigStore?.loadConfig) {
            console.log('[loadPersistedConfiguration] Falling back to AppConfigStore');
            return window.AppConfigStore.loadConfig();
        }
    } catch (error) {
        console.error('[loadPersistedConfiguration] AppConfigStore error:', error);
    }

    // Final fallback: Cargar desde localStorage
    try {
        console.log('[loadPersistedConfiguration] Falling back to localStorage');
        const storedConfig = localStorage.getItem(connectionStorageKey);
        return storedConfig ? JSON.parse(storedConfig) : null;
    } catch (error) {
        console.error('[loadPersistedConfiguration] localStorage error:', error);
        return null;
    }
}

function setSaveStatus(status, message) {
    const saveStatus = document.getElementById('saveStatus');

    if (!saveStatus) {
        return;
    }

    saveStatus.className = `save-status ${status}`;
    saveStatus.textContent = message;
}

function validateSftpConnectionConfig(config) {
    const errors = [];

    if (!config.host) {
        errors.push('Host is required');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
        errors.push('Port must be between 1 and 65535');
    }

    if (!config.username) {
        errors.push('Username is required');
    }

    if (config.authType === 'password' && !config.password) {
        errors.push('Password is required');
    }

    if (config.authType === 'privateKey' && !config.privateKey) {
        errors.push('Private Key is required');
    }

    if (config.authType === 'password' && config.privateKey) {
        errors.push('Password and Private Key cannot be used at the same time');
    }

    if (config.authType === 'privateKey' && config.password) {
        errors.push('Private Key and Password cannot be used at the same time');
    }

    if (!config.remotePath) {
        errors.push('Remote Path is required');
    }

    if (!config.fileNamePattern) {
        errors.push('File Name Pattern is required');
    }

    return errors;
}

function testSftpConnection() {
    const config = getSftpConnectionConfig();
    const lines = [createPlainLogLine('Testing connection...')];
    const validationErrors = validateSftpConnectionConfig(config);
    let status = 'READY';

    if (validationErrors.length > 0) {
        validationErrors.forEach(error => {
            lines.push(createLogLine('error', error));
        });
        renderConnectionLog(lines, 'FAILED');
        setSaveButtonsEnabled(false);
        return;
    }

    if (!sftpConnectionTestState.hostResolved) {
        lines.push(createLogLine('error', 'Cannot resolve host'));
        status = 'FAILED';
    } else {
        lines.push(createLogLine('success', 'Resolving host...'));
    }

    if (status !== 'FAILED' && !sftpConnectionTestState.serverConnected) {
        lines.push(createLogLine('error', `Connection timeout (port ${config.port})`));
        status = 'FAILED';
    } else if (status !== 'FAILED') {
        lines.push(createLogLine('success', `Connecting to server (port ${config.port})...`));
    }

    if (status !== 'FAILED' && !sftpConnectionTestState.authenticated) {
        lines.push(createLogLine('error', 'Authentication failed'));
        status = 'FAILED';
    } else if (status !== 'FAILED') {
        lines.push(createLogLine('success', 'Authentication successful'));
    }

    if (status !== 'FAILED' && !sftpConnectionTestState.remotePathAccessible) {
        lines.push(createLogLine('error', 'Remote path not found'));
        status = 'FAILED';
    } else if (status !== 'FAILED') {
        lines.push(createLogLine('success', 'Remote path accessible'));
    }

    if (status !== 'FAILED') {
        lines.push(createLogLine('success', `Checking file (${config.fileNamePattern})...`));

        if (sftpConnectionTestState.fileCheckError) {
            lines.push(createLogLine('error', 'File not found'));
            status = 'FAILED';
        } else if (sftpConnectionTestState.matchedFileCount > 0) {
            lines.push(createLogLine('success', `File found (${sftpConnectionTestState.matchedFileCount})`));
        } else {
            lines.push(createLogLine('warning', 'No files found'));
            status = 'PARTIAL';
        }
    }

    renderConnectionLog(lines, status);
    setSaveButtonsEnabled(status === 'READY');
}

function resetConnectionLog() {
    document.getElementById('connectionLogLines').innerHTML = '<p class="log-line plain">Select a connection type and run a test.</p>';
    document.getElementById('connectionStatus').className = 'connection-status';
    document.getElementById('connectionStatus').textContent = 'STATUS: NOT TESTED';
    setSaveStatus('', 'SAVE: NOT SAVED');
    setSaveButtonsEnabled(false);
}

function createLogLine(type, text) {
    const icon = logIcon[type] || '';
    return {
        type,
        text: `${icon} ${text}`
    };
}

function createPlainLogLine(text) {
    return {
        type: 'plain',
        text
    };
}

function renderConnectionLog(lines, status) {
    const logContainer = document.getElementById('connectionLogLines');
    const statusElement = document.getElementById('connectionStatus');

    logContainer.innerHTML = lines.map(line => {
        const className = `log-line ${line.type}`;
        return `<p class="${className}">${line.text}</p>`;
    }).join('');

    statusElement.className = `connection-status ${status.toLowerCase()}`;
    statusElement.textContent = `STATUS: ${status}`;
}

function setSaveButtonsEnabled(enabled) {
    const buttons = document.querySelectorAll('.save-config-button');
    buttons.forEach(button => {
        button.disabled = !enabled;
    });
}

function addColumn() {
    const tbody = document.getElementById('columnsBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" placeholder="column_name"></td>
        <td>
            <select>
                <option>String</option>
                <option>Date</option>
                <option>Number</option>
            </select>
        </td>
        <td><span class="delete-btn" onclick="removeRow(this)">x</span></td>
    `;
    tbody.appendChild(newRow);
}

function addMapping() {
    const tbody = document.getElementById('mappingBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" placeholder="client_field"></td>
        <td><input type="text" placeholder="system_field"></td>
        <td><input type="text" placeholder="transformation()"></td>
        <td><span class="delete-btn" onclick="removeRow(this)">x</span></td>
    `;
    tbody.appendChild(newRow);
}

function removeRow(element) {
    element.closest('tr').remove();
}

// ==================== INITIALIZATION ====================
/**
 * Initialize application when DOM is ready
 * Loads saved configuration and initializes UI components
 */

// ==================== PARSER UI WRAPPERS ====================
/**
 * Wrapper functions to call ParserUI methods from HTML onclick
 * These ensure ParserUI is available when called
 */
function addParserColumn() {
  if (window.ParserUI) {
    window.ParserUI.addParserColumn();
  } else {
    console.error('[Wrapper] ParserUI not available');
  }
}

function removeParserColumn(element) {
  if (window.ParserUI) {
    window.ParserUI.removeParserColumn(element);
  } else {
    console.error('[Wrapper] ParserUI not available');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing CSV Integration...');
  
  try {
    // Initialize network path client
    initializeNetworkPathClient();
    console.log('[App] Network Path Client initialized');
    
    // Initialize Parser UI
    ParserUI.init();
    console.log('[App] Parser UI initialized');
    
    // Load saved configuration (both Connector and Parser)
    console.log('[App] Loading saved configuration...');
    const configLoaded = await ConfigLoader.loadAndRenderNetworkConfig();
    
    if (configLoaded) {
      console.log('[App] Configuration loaded successfully');
    } else {
      console.log('[App] No saved configuration found - starting fresh');
    }
    
    console.log('[App] Initialization complete');
  } catch (error) {
    console.error('[App] Initialization error:', error);
  }
});
