/**
 * MappingUI - Manages the Mapping tab
 *
 * Reads parser columns from saved config and lets the user assign
 * a JSON tag name to each column.  The mapping is saved to the backend
 * as config.mapping and applied by /api/product/search at runtime.
 *
 * Mapping entry schema:
 *   { csvColumn: string, index: number, jsonTag: string, include: boolean }
 */

class MappingUI {

  // ==================== INITIALIZATION ====================

  static init() {
    console.log('[MappingUI] Initializing...');

    const saveBtn = document.getElementById('saveMappingBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => MappingUI.saveMapping());
    }

    console.log('[MappingUI] Initialized');
  }

  // ==================== LOAD ====================

  /**
   * Load parser columns + any previously saved mapping and render the table.
   * Called every time the user navigates to the Mapping tab.
   */
  static async loadFromParser() {
    console.log('[MappingUI] Loading from parser config...');

    let appConfig = null;

    try {
      const response = await fetch('/api/config/load');
      const data = await response.json();

      if (data.status === 'SUCCESS' && data.config) {
        appConfig = data.config;
      }
    } catch (err) {
      console.error('[MappingUI] Could not reach backend:', err);
      MappingUI.showPlaceholder('Cannot reach the server. Is it running?');
      return false;
    }

    const parserColumns = appConfig?.parser?.columns;

    if (!Array.isArray(parserColumns) || parserColumns.length === 0) {
      MappingUI.showPlaceholder(
        'No parser columns found. Configure and save the Parser tab first.'
      );
      return false;
    }

    // Build lookup of previously saved mapping entries by csvColumn name
    const savedMap = {};
    (appConfig.mapping || []).forEach(m => {
      savedMap[m.csvColumn] = m;
    });

    // Render table
    const tbody = document.getElementById('mappingBody');
    tbody.innerHTML = '';

    parserColumns.forEach(col => {
      const saved   = savedMap[col.name];
      const jsonTag = saved ? saved.jsonTag : col.name;
      const include = saved !== undefined ? saved.include : true;

      const row = document.createElement('tr');
      row.dataset.csvColumn = col.name;
      row.dataset.index     = col.index;

      row.innerHTML = `
        <td><span class="mapping-csv-col">${MappingUI._esc(col.name)}</span></td>
        <td>
          <input
            type="text"
            class="mapping-tag-input"
            value="${MappingUI._esc(jsonTag)}"
            placeholder="json_tag_name"
            spellcheck="false"
          >
        </td>
        <td class="mapping-include-cell">
          <input type="checkbox" class="mapping-include-chk" ${include ? 'checked' : ''}>
        </td>
      `;

      tbody.appendChild(row);
    });

    console.log(`[MappingUI] Table populated with ${parserColumns.length} rows`);

    // Restore status badge based on whether mapping was already saved
    if (appConfig.mapping && appConfig.mapping.length > 0) {
      MappingUI._setStatus('SAVED', 'saved');
    } else {
      MappingUI._setStatus('NOT SAVED', 'idle');
    }

    return true;
  }

  // ==================== ACTIONS ====================

  /**
   * Collect the table, validate, and POST to /api/config/save.
   */
  static async saveMapping() {
    const saveBtn = document.getElementById('saveMappingBtn');

    try {
      MappingUI._setStatus('SAVING...', 'saving');
      if (saveBtn) saveBtn.disabled = true;

      const rows = document.querySelectorAll('#mappingBody tr[data-csv-column]');

      if (rows.length === 0) {
        MappingUI._setStatus('NO COLUMNS', 'error');
        return;
      }

      // Validate: every included row must have a non-empty tag
      let hasError = false;
      const mapping = [];

      rows.forEach(row => {
        const csvColumn = row.dataset.csvColumn;
        const index     = parseInt(row.dataset.index, 10);
        const tagInput = row.querySelector('.mapping-tag-input');
        const include  = row.querySelector('.mapping-include-chk')?.checked ?? true;
        const jsonTag   = tagInput?.value?.trim() || '';

        if (include && !jsonTag) {
          hasError = true;
          tagInput.classList.add('mapping-tag-error');
        } else {
          tagInput?.classList.remove('mapping-tag-error');
          mapping.push({ csvColumn, index, jsonTag: jsonTag || csvColumn, include });
        }
      });

      if (hasError) {
        MappingUI._setStatus('FIX EMPTY TAGS', 'error');
        return;
      }

      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mapping })
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        MappingUI._setStatus('SAVED', 'saved');
        console.log('[MappingUI] Mapping saved:', mapping);
      } else {
        MappingUI._setStatus('SAVE ERROR', 'error');
        console.error('[MappingUI] Backend error:', data);
      }

    } catch (err) {
      console.error('[MappingUI] Save error:', err);
      MappingUI._setStatus('SAVE ERROR', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ==================== HELPERS ====================

  static _setStatus(text, state) {
    const el = document.getElementById('mappingStatus');
    if (!el) return;
    el.textContent = `MAPPING: ${text}`;
    el.className = `mapping-status mapping-status--${state}`;
  }

  static showPlaceholder(message) {
    const tbody = document.getElementById('mappingBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="mapping-placeholder">${MappingUI._esc(message)}</td>
        </tr>
      `;
    }
    MappingUI._setStatus('NOT CONFIGURED', 'idle');
  }

  /** Minimal HTML escaping for values rendered into innerHTML */
  static _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Export
if (typeof window !== 'undefined') {
  window.MappingUI = MappingUI;
}
