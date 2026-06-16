/**
 * ApiRespConnectorUI — Tab 1: API Connector configuration.
 *
 * Fields: baseUrl, path (with {productCode}), method, bodyTemplate,
 *         authType, apiKeyHeader, apiKeyValue, bearerToken, basicUsername, basicPassword
 *
 * Sends a real HTTP request via POST /api/apiResp/test-connection.
 * Enables Save only after a successful test.
 */

class ApiRespConnectorUI {

  static init() {
    console.log('[ApiRespConnectorUI] Initialized');
  }

  static handleMethodChange() {
    const method = document.getElementById('arMethod').value;
    const bodyGroup = document.getElementById('arBodyGroup');
    if (bodyGroup) bodyGroup.style.display = method === 'POST' ? '' : 'none';
  }

  static handleAuthTypeChange() {
    const authType = document.getElementById('arAuthType').value;
    document.getElementById('arApiKeyFields').style.display  = authType === 'apiKey'  ? '' : 'none';
    document.getElementById('arBearerFields').style.display  = authType === 'bearer'  ? '' : 'none';
    document.getElementById('arBasicFields').style.display   = authType === 'basic'   ? '' : 'none';
  }

  static _getConfig() {
    return {
      baseUrl:       document.getElementById('arBaseUrl').value.trim(),
      path:          document.getElementById('arPath').value.trim(),
      method:        document.getElementById('arMethod').value,
      bodyTemplate:  document.getElementById('arBodyTemplate').value.trim(),
      authType:      document.getElementById('arAuthType').value,
      apiKeyHeader:  document.getElementById('arApiKeyHeader').value.trim(),
      apiKeyValue:   document.getElementById('arApiKeyValue').value,
      bearerToken:   document.getElementById('arBearerToken').value,
      basicUsername: document.getElementById('arBasicUsername').value.trim(),
      basicPassword: document.getElementById('arBasicPassword').value
    };
  }

  static async testConnection() {
    const config  = ApiRespConnectorUI._getConfig();
    const testCode = document.getElementById('arTestCode').value.trim() || 'TEST001';

    if (!config.baseUrl || !config.path) {
      ApiRespConnectorUI._renderLog([{ type: 'error', text: '✗ Base URL and Endpoint Path are required' }], 'FAILED');
      return;
    }

    ApiRespConnectorUI._renderLog([{ type: 'plain', text: 'Connecting to API...' }], 'TESTING');

    try {
      const response = await fetch('/api/apiResp/test-connection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ connector: config, testProductCode: testCode })
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        ApiRespConnectorUI._renderLog([
          { type: 'success', text: `✓ Connected — ${config.method} ${config.baseUrl}${config.path.replace('{productCode}', testCode)}` },
          { type: 'success', text: `✓ Response received (${data.fieldCount} fields detected)` },
          { type: 'plain',   text: `Preview: ${data.preview}` }
        ], 'READY');
        ApiRespConnectorUI._setSaveEnabled(true);
        ApiRespConnectorUI._setSaveStatus('', 'SAVE: NOT SAVED');
      } else {
        ApiRespConnectorUI._renderLog([
          { type: 'error', text: `✗ ${data.error || 'Connection failed'}` }
        ], 'FAILED');
        ApiRespConnectorUI._setSaveEnabled(false);
      }
    } catch (err) {
      ApiRespConnectorUI._renderLog([{ type: 'error', text: `✗ ${err.message}` }], 'FAILED');
      ApiRespConnectorUI._setSaveEnabled(false);
    }
  }

  static async saveConnector() {
    const config = ApiRespConnectorUI._getConfig();
    ApiRespConnectorUI._setSaveStatus('saving', 'SAVE: SAVING...');

    try {
      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiResp: { connector: config } })
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        ApiRespConnectorUI._setSaveStatus('saved', 'SAVE: SAVED');
      } else {
        ApiRespConnectorUI._setSaveStatus('failed', 'SAVE: ERROR');
      }
    } catch (err) {
      ApiRespConnectorUI._setSaveStatus('failed', 'SAVE: ERROR');
    }
  }

  static async loadConfig() {
    try {
      const response = await fetch('/api/config/load');
      const data = await response.json();
      const c = data?.config?.apiResp?.connector;
      if (!c) return;

      document.getElementById('arBaseUrl').value       = c.baseUrl       || '';
      document.getElementById('arPath').value          = c.path          || '';
      document.getElementById('arMethod').value        = c.method        || 'GET';
      document.getElementById('arBodyTemplate').value  = c.bodyTemplate  || '';
      document.getElementById('arAuthType').value      = c.authType      || 'none';
      document.getElementById('arApiKeyHeader').value  = c.apiKeyHeader  || '';
      document.getElementById('arApiKeyValue').value   = c.apiKeyValue   || '';
      document.getElementById('arBearerToken').value   = c.bearerToken   || '';
      document.getElementById('arBasicUsername').value = c.basicUsername || '';
      document.getElementById('arBasicPassword').value = c.basicPassword || '';

      ApiRespConnectorUI.handleMethodChange();
      ApiRespConnectorUI.handleAuthTypeChange();

      if (c.baseUrl && c.path) {
        ApiRespConnectorUI._setSaveEnabled(true);
        ApiRespConnectorUI._setSaveStatus('saved', 'SAVE: SAVED');
      }
    } catch (err) {
      console.error('[ApiRespConnectorUI] Load error:', err);
    }
  }

  static _renderLog(lines, status) {
    const container  = document.getElementById('arConnectorLogLines');
    const statusEl   = document.getElementById('arConnectorStatus');
    if (container) {
      container.innerHTML = lines.map(l => `<p class="log-line ${l.type}">${ApiRespConnectorUI._esc(l.text)}</p>`).join('');
    }
    if (statusEl) {
      statusEl.className   = `connection-status ${status.toLowerCase()}`;
      statusEl.textContent = `STATUS: ${status}`;
    }
  }

  static _setSaveEnabled(enabled) {
    const btn = document.getElementById('arSaveConnectorBtn');
    if (btn) btn.disabled = !enabled;
  }

  static _setSaveStatus(cls, text) {
    const el = document.getElementById('arConnectorSaveStatus');
    if (!el) return;
    el.className   = `save-status ${cls}`;
    el.textContent = text;
  }

  static _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

if (typeof window !== 'undefined') window.ApiRespConnectorUI = ApiRespConnectorUI;
