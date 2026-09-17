const logIcon = {
    success: '✓',
    error: '✗',
    warning: '⚠'
};

// Client to connect with backend (misma origen: funciona con cualquier PORT)
let networkPathClient = null;

function initializeNetworkPathClient() {
    if (!networkPathClient) {
        networkPathClient = new NetworkPathClient();
    }
    return networkPathClient;
}

/** Escapa texto para insertarlo como HTML. */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openTab(index) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    tabs[index].classList.add('active');
    contents[index].classList.add('active');

    // Tab 1 = Parser — re-evaluate Check button (connector may now be READY/SAVED)
    if (index === 1 && window.ParserUI) {
        ParserUI.updateCheckButtonState();
    }

    // Tab 2 = Mapping (0-based index)
    if (index === 2 && window.MappingUI) {
        MappingUI.loadFromParser();
    }

    // Tab 3 = Validation
    if (index === 3 && window.ValidationUI) {
        ValidationUI.loadFromMapping();
    }

    // Tab 4 = Persistence
    if (index === 4 && window.PersistenceUI) {
        PersistenceUI.load();
    }
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

async function saveCurrentConnectionConfig() {
    setSaveStatus('saving', 'SAVE: SAVING...');

    try {
        const storedConfig = await getCurrentConnectionConfigForStorage();
        const appConfig = {
            connection: storedConfig
        };

        await persistConfiguration(appConfig);
        setSaveStatus('saved', 'SAVE: SAVED');
        if (window.ParserUI) ParserUI.updateCheckButtonState();
    } catch (error) {
        setSaveStatus('failed', 'SAVE: SAVE ERROR');
        renderConnectionLog([createLogLine('error', error.message)], 'FAILED');
    }
}

async function persistConfiguration(config) {
    const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });

    if (!response.ok) {
        throw new Error(`Server error ${response.status} — configuration not saved`);
    }

    const data = await response.json();
    if (data.status !== 'SUCCESS') {
        throw new Error(data.error || 'Configuration not saved');
    }
}

async function loadPersistedConfiguration() {
    const response = await fetch('/api/config/load');

    if (!response.ok) {
        throw new Error(`Server error ${response.status} — could not load configuration`);
    }

    const data = await response.json();
    if (data.status === 'SUCCESS' && data.config) {
        return data.config;
    }

    return null;
}

function setSaveStatus(status, message) {
    const saveStatus = document.getElementById('saveStatus');

    if (!saveStatus) {
        return;
    }

    saveStatus.className = `save-status ${status}`;
    saveStatus.textContent = message;
}

function testSftpConnection() {
    // SFTP aún no está implementado en el backend: no se permite guardarlo
    renderConnectionLog([createLogLine('error', 'SFTP is not available yet. Use Network Path.')], 'FAILED');
    setSaveButtonsEnabled(false);
}

function resetConnectionLog() {
    document.getElementById('connectionLogLines').innerHTML = '<p class="log-line plain">Select a connection type and run a test.</p>';
    document.getElementById('connectionStatus').className = 'connection-status';
    document.getElementById('connectionStatus').textContent = 'STATUS: NOT TESTED';
    setSaveStatus('', 'SAVE: NOT SAVED');
    setSaveButtonsEnabled(false);
    if (window.ParserUI) ParserUI.updateCheckButtonState();
}

/**
 * Cualquier cambio en los campos del conector invalida la prueba y el guardado:
 * hay que volver a probar y guardar antes de usarlo en el Parser.
 */
function markConnectorDirty() {
    const saveStatus = document.getElementById('saveStatus');
    const statusElement = document.getElementById('connectionStatus');
    const wasTouched = saveStatus?.textContent !== 'SAVE: NOT SAVED' || statusElement?.textContent !== 'STATUS: NOT TESTED';
    if (wasTouched) resetConnectionLog();
}

/** Tras cargar del backend una conexión ya guardada. */
function markConnectorSavedFromBackend() {
    setSaveStatus('saved', 'SAVE: SAVED');
    if (window.ParserUI) ParserUI.updateCheckButtonState();
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

    // Los mensajes pueden traer nombres de archivo/rutas: se escapan y solo <br> se respeta
    logContainer.innerHTML = lines.map(line => {
        const className = `log-line ${escapeHtml(line.type)}`;
        const html = escapeHtml(line.text).replace(/&lt;br\s*\/?&gt;/gi, '<br>');
        return `<p class="${className}">${html}</p>`;
    }).join('');

    statusElement.className = `connection-status ${status.toLowerCase()}`;
    statusElement.textContent = `STATUS: ${status}`;
}

function setSaveButtonsEnabled(enabled) {
    // Solo los botones de guardado del conector (no Parser/Mapping/Validation/Persistence)
    const buttons = document.querySelectorAll('#networkPathFields .save-config-button, #sftpFields .save-config-button');
    buttons.forEach(button => {
        button.disabled = !enabled;
    });
}

// ==================== INITIALIZATION ====================
/**
 * Initialize application when DOM is ready
 * Loads saved configuration and initializes UI components
 */

// ==================== PARSER UI WRAPPERS ====================
// Llamados desde onclick del HTML
function addParserColumn() {
  ParserUI.addParserColumn();
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing CSV Integration...');
  
  try {
    initializeNetworkPathClient();

    // Editar cualquier campo del conector obliga a volver a probar y guardar
    document.querySelectorAll('#networkPathFields input').forEach(input => {
      input.addEventListener('input', markConnectorDirty);
      input.addEventListener('change', markConnectorDirty);
    });

    // Initialize Parser UI
    ParserUI.init();
    console.log('[App] Parser UI initialized');

    // Initialize Mapping UI
    MappingUI.init();
    console.log('[App] Mapping UI initialized');

    // Initialize Validation UI
    ValidationUI.init();
    console.log('[App] Validation UI initialized');

    // Initialize Persistence UI
    PersistenceUI.init();
    console.log('[App] Persistence UI initialized');

    // Load saved configuration (both Connector and Parser)
    console.log('[App] Loading saved configuration...');
    const configLoaded = await ConfigLoader.loadAndRenderNetworkConfig();
    if (configLoaded) {
      markConnectorSavedFromBackend();
    }

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
