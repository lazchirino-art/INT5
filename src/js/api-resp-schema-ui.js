/**
 * ApiRespSchemaUI — Tab 2: Response Schema.
 *
 * The user pastes a sample JSON response (or fetches from the saved connector).
 * The wizard auto-detects all leaf field paths and lets the user choose which to include.
 *
 * Schema entry: { path: string, include: boolean }
 * Saved under config.apiResp.schema
 */

class ApiRespSchemaUI {

  static init() {
    console.log('[ApiRespSchemaUI] Initialized');
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  static async load() {
    try {
      const response = await fetch('/api/config/load');
      const data     = await response.json();
      const schema   = data?.config?.apiResp?.schema;

      if (Array.isArray(schema) && schema.length > 0) {
        ApiRespSchemaUI._renderTable(schema.map(s => ({
          path:    s.path,
          value:   s.exampleValue || '',
          include: s.include !== false
        })));
        ApiRespSchemaUI._setStatus('SAVED', 'saved');
        document.getElementById('arSaveSchemaBtn').disabled = false;
      }
    } catch (err) {
      console.error('[ApiRespSchemaUI] Load error:', err);
    }
  }

  // ── Parse client-side ─────────────────────────────────────────────────────

  static parseJson() {
    const raw = document.getElementById('arSampleJson').value.trim();
    if (!raw) {
      ApiRespSchemaUI._setLog('Paste a JSON response first.', 'error');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      ApiRespSchemaUI._setLog(`Invalid JSON: ${e.message}`, 'error');
      return;
    }

    const fields = ApiRespSchemaUI._extractFields(parsed);

    if (fields.length === 0) {
      ApiRespSchemaUI._setLog('No fields detected in the JSON.', 'warning');
      return;
    }

    ApiRespSchemaUI._renderTable(fields);
    ApiRespSchemaUI._setLog(`${fields.length} field(s) detected.`, 'success');
    ApiRespSchemaUI._setStatus('NOT SAVED', 'idle');
    document.getElementById('arSaveSchemaBtn').disabled = false;
  }

  // ── Fetch from saved connector ────────────────────────────────────────────

  static async fetchFromApi() {
    const testCode = document.getElementById('arSchemaTestCode').value.trim() || 'TEST001';
    ApiRespSchemaUI._setLog('Fetching from API...', 'plain');

    try {
      const response = await fetch('/api/apiResp/test-connection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ testProductCode: testCode, useStoredConnector: true })
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS' || !data.rawJson) {
        ApiRespSchemaUI._setLog(`Failed: ${data.error || 'No response from API'}`, 'error');
        return;
      }

      // Populate textarea with pretty JSON
      document.getElementById('arSampleJson').value = JSON.stringify(data.rawJson, null, 2);

      const fields = ApiRespSchemaUI._extractFields(data.rawJson);
      ApiRespSchemaUI._renderTable(fields);
      ApiRespSchemaUI._setLog(`Fetched from API — ${fields.length} field(s) detected.`, 'success');
      ApiRespSchemaUI._setStatus('NOT SAVED', 'idle');
      document.getElementById('arSaveSchemaBtn').disabled = false;

    } catch (err) {
      ApiRespSchemaUI._setLog(`Error: ${err.message}`, 'error');
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  static async saveSchema() {
    const rows = document.querySelectorAll('#arSchemaBody tr[data-path]');
    if (rows.length === 0) {
      ApiRespSchemaUI._setStatus('NO FIELDS', 'error');
      return;
    }

    const schema = [];
    rows.forEach(row => {
      const include = row.querySelector('.ar-schema-include')?.checked ?? true;
      schema.push({
        path:         row.dataset.path,
        exampleValue: row.dataset.example || '',
        include
      });
    });

    ApiRespSchemaUI._setStatus('SAVING...', 'saving');

    try {
      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiResp: { schema } })
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        ApiRespSchemaUI._setStatus('SAVED', 'saved');
        console.log('[ApiRespSchemaUI] Schema saved:', schema);
      } else {
        ApiRespSchemaUI._setStatus('SAVE ERROR', 'error');
      }
    } catch (err) {
      ApiRespSchemaUI._setStatus('SAVE ERROR', 'error');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static _extractFields(json, prefix = '') {
    if (!json || typeof json !== 'object') return [];
    const fields = [];
    for (const [key, value] of Object.entries(json)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        if (value.length > 0 && value[0] !== null && typeof value[0] === 'object') {
          fields.push(...ApiRespSchemaUI._extractFields(value[0], `${path}[0]`));
        } else {
          fields.push({ path, value: JSON.stringify(value).slice(0, 60), include: true });
        }
      } else if (value !== null && typeof value === 'object') {
        fields.push(...ApiRespSchemaUI._extractFields(value, path));
      } else {
        fields.push({ path, value: String(value ?? ''), include: true });
      }
    }
    return fields;
  }

  static _renderTable(fields) {
    const tbody = document.getElementById('arSchemaBody');
    if (!tbody) return;
    tbody.innerHTML = fields.map(f => `
      <tr data-path="${ApiRespSchemaUI._esc(f.path)}" data-example="${ApiRespSchemaUI._esc(f.value)}">
        <td><code class="ar-schema-path">${ApiRespSchemaUI._esc(f.path)}</code></td>
        <td class="ar-schema-example">${ApiRespSchemaUI._esc(String(f.value).slice(0, 60))}</td>
        <td class="mapping-include-cell">
          <input type="checkbox" class="ar-schema-include mapping-include-chk" ${f.include !== false ? 'checked' : ''}>
        </td>
      </tr>
    `).join('');
  }

  static _setLog(message, type = 'plain') {
    const el = document.getElementById('arSchemaLogLines');
    if (el) el.innerHTML = `<p class="log-line ${type}">${ApiRespSchemaUI._esc(message)}</p>`;
    const st = document.getElementById('arSchemaStatus');
    if (st) {
      const map = { success: 'valid', error: 'failed', warning: '', plain: '' };
      st.className   = `parser-status ${map[type] || ''}`;
      st.textContent = `STATUS: ${type.toUpperCase()}`;
    }
  }

  static _setStatus(text, state) {
    const el = document.getElementById('arSchemaStatus');
    if (!el) return;
    const map = { saved: 'valid', saving: '', error: 'failed', idle: '', warning: '' };
    el.className   = `parser-status ${map[state] || ''}`;
    el.textContent = `STATUS: ${text}`;
  }

  static _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

if (typeof window !== 'undefined') window.ApiRespSchemaUI = ApiRespSchemaUI;
