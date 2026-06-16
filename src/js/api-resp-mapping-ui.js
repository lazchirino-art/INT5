/**
 * ApiRespMappingUI — Tab 3: Field Mapping for API-RESP integration.
 *
 * Reads included fields from config.apiResp.schema.
 * Lets the user assign a JSON output tag to each field path.
 *
 * Mapping entry: { fieldPath, jsonTag, include }
 * Saved under config.apiResp.mapping
 */

class ApiRespMappingUI {

  static init() {
    const saveBtn = document.getElementById('arSaveMappingBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => ApiRespMappingUI.saveMapping());
    console.log('[ApiRespMappingUI] Initialized');
  }

  static async loadFromSchema() {
    console.log('[ApiRespMappingUI] Loading from schema...');

    let appConfig = null;
    try {
      const response = await fetch('/api/config/load');
      const data     = await response.json();
      if (data.status === 'SUCCESS' && data.config) appConfig = data.config;
    } catch (err) {
      ApiRespMappingUI._showPlaceholder('Cannot reach the server. Is it running?');
      return false;
    }

    const schema = (appConfig?.apiResp?.schema || []).filter(s => s.include !== false);

    if (schema.length === 0) {
      ApiRespMappingUI._showPlaceholder('No schema fields found. Configure and save the Response Schema tab first.');
      return false;
    }

    const savedMap = {};
    (appConfig?.apiResp?.mapping || []).forEach(m => { savedMap[m.fieldPath] = m; });

    const tbody = document.getElementById('arMappingBody');
    tbody.innerHTML = '';

    schema.forEach(field => {
      const saved   = savedMap[field.path];
      const jsonTag = saved ? saved.jsonTag : field.path.replace(/[.\[\]]/g, '_');
      const include = saved !== undefined ? saved.include : true;

      const row = document.createElement('tr');
      row.dataset.fieldPath = field.path;
      row.innerHTML = `
        <td><code class="mapping-csv-col">${ApiRespMappingUI._esc(field.path)}</code></td>
        <td>
          <input type="text" class="mapping-tag-input"
            value="${ApiRespMappingUI._esc(jsonTag)}"
            placeholder="json_tag_name" spellcheck="false">
        </td>
        <td class="mapping-include-cell">
          <input type="checkbox" class="mapping-include-chk" ${include ? 'checked' : ''}>
        </td>
      `;
      tbody.appendChild(row);
    });

    if (appConfig?.apiResp?.mapping?.length > 0) {
      ApiRespMappingUI._setStatus('SAVED', 'saved');
    } else {
      ApiRespMappingUI._setStatus('NOT SAVED', 'idle');
    }

    return true;
  }

  static async saveMapping() {
    const saveBtn = document.getElementById('arSaveMappingBtn');
    try {
      ApiRespMappingUI._setStatus('SAVING...', 'saving');
      if (saveBtn) saveBtn.disabled = true;

      const rows = document.querySelectorAll('#arMappingBody tr[data-field-path]');
      if (rows.length === 0) { ApiRespMappingUI._setStatus('NO FIELDS', 'error'); return; }

      let hasError = false;
      const mapping = [];

      rows.forEach(row => {
        const fieldPath = row.dataset.fieldPath;
        const tagInput  = row.querySelector('.mapping-tag-input');
        const include   = row.querySelector('.mapping-include-chk')?.checked ?? true;
        const jsonTag   = tagInput?.value?.trim() || '';

        if (include && !jsonTag) {
          hasError = true;
          tagInput.classList.add('mapping-tag-error');
        } else {
          tagInput?.classList.remove('mapping-tag-error');
          mapping.push({ fieldPath, jsonTag: jsonTag || fieldPath, include });
        }
      });

      if (hasError) { ApiRespMappingUI._setStatus('FIX EMPTY TAGS', 'error'); return; }

      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiResp: { mapping } })
      });

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        ApiRespMappingUI._setStatus('SAVED', 'saved');
        // Reload validation tab if visible
        if (window.ApiRespValidationUI) await ApiRespValidationUI.loadFromMapping();
      } else {
        ApiRespMappingUI._setStatus('SAVE ERROR', 'error');
      }
    } catch (err) {
      ApiRespMappingUI._setStatus('SAVE ERROR', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  static _setStatus(text, state) {
    const el = document.getElementById('arMappingStatus');
    if (!el) return;
    el.textContent = `MAPPING: ${text}`;
    el.className   = `mapping-status mapping-status--${state}`;
  }

  static _showPlaceholder(msg) {
    const tbody = document.getElementById('arMappingBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="mapping-placeholder">${ApiRespMappingUI._esc(msg)}</td></tr>`;
    ApiRespMappingUI._setStatus('NOT CONFIGURED', 'idle');
  }

  static _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

if (typeof window !== 'undefined') window.ApiRespMappingUI = ApiRespMappingUI;
