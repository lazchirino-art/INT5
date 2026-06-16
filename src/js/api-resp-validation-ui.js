/**
 * ApiRespValidationUI — Tab 4: Validation for API-RESP integration.
 *
 * Reads the saved mapping (apiResp.mapping, include !== false).
 * Lets the user mark each field as required.
 *
 * Saved under config.apiResp.validation as [{ fieldPath, jsonTag, required }]
 */

class ApiRespValidationUI {

  static init() {
    const saveBtn = document.getElementById('arSaveValidationBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => ApiRespValidationUI.saveRules());
    console.log('[ApiRespValidationUI] Initialized');
  }

  static async loadFromMapping() {
    console.log('[ApiRespValidationUI] Loading from mapping...');

    let appConfig = null;
    try {
      const response = await fetch('/api/config/load');
      const data     = await response.json();
      if (data.status === 'SUCCESS' && data.config) appConfig = data.config;
    } catch (err) {
      ApiRespValidationUI._showPlaceholder('Cannot reach the server. Is it running?');
      return;
    }

    const mapping = (appConfig?.apiResp?.mapping || []).filter(m => m.include !== false);

    if (mapping.length === 0) {
      ApiRespValidationUI._showPlaceholder('No mapped fields found. Configure and save the Mapping tab first.');
      return;
    }

    const savedRules = {};
    (appConfig?.apiResp?.validation || []).forEach(v => { savedRules[v.fieldPath] = v; });

    const tbody = document.getElementById('arValidationBody');
    tbody.innerHTML = '';

    mapping.forEach(field => {
      const saved    = savedRules[field.fieldPath];
      const required = saved ? !!saved.required : false;

      const row = document.createElement('tr');
      row.dataset.fieldPath = field.fieldPath;
      row.dataset.jsonTag   = field.jsonTag;
      row.innerHTML = `
        <td><code class="validation-csv-col">${ApiRespValidationUI._esc(field.fieldPath)}</code></td>
        <td class="validation-json-tag">${ApiRespValidationUI._esc(field.jsonTag)}</td>
        <td class="validation-required-cell">
          <input type="checkbox" class="validation-required-chk" ${required ? 'checked' : ''}>
        </td>
      `;
      tbody.appendChild(row);
    });

    if (appConfig?.apiResp?.validation?.length > 0) {
      ApiRespValidationUI._setStatus('SAVED', 'saved');
    } else {
      ApiRespValidationUI._setStatus('NOT SAVED', 'idle');
    }
  }

  static async saveRules() {
    const saveBtn = document.getElementById('arSaveValidationBtn');
    try {
      ApiRespValidationUI._setStatus('SAVING...', 'saving');
      if (saveBtn) saveBtn.disabled = true;

      const rows = document.querySelectorAll('#arValidationBody tr[data-field-path]');
      if (rows.length === 0) {
        ApiRespValidationUI._setStatus('NO FIELDS', 'error');
        return;
      }

      const validation = [];
      rows.forEach(row => {
        validation.push({
          fieldPath: row.dataset.fieldPath,
          jsonTag:   row.dataset.jsonTag,
          required:  row.querySelector('.validation-required-chk')?.checked ?? false
        });
      });

      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiResp: { validation } })
      });

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        ApiRespValidationUI._setStatus('SAVED', 'saved');
      } else {
        ApiRespValidationUI._setStatus('SAVE ERROR', 'error');
      }
    } catch (err) {
      ApiRespValidationUI._setStatus('SAVE ERROR', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  static _setStatus(text, state) {
    const el = document.getElementById('arValidationStatus');
    if (!el) return;
    el.textContent = `VALIDATION: ${text}`;
    el.className   = `validation-status validation-status--${state}`;
  }

  static _showPlaceholder(msg) {
    const tbody = document.getElementById('arValidationBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="validation-placeholder">${ApiRespValidationUI._esc(msg)}</td></tr>`;
    ApiRespValidationUI._setStatus('NOT CONFIGURED', 'idle');
  }

  static _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

if (typeof window !== 'undefined') window.ApiRespValidationUI = ApiRespValidationUI;
