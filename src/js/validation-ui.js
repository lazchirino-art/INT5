/**
 * ValidationUI — Manages the Validation tab (Tab 4).
 *
 * Auto-populated from the saved Mapping config.
 * Each row: CSV Column | JSON Tag | Required checkbox.
 *
 * When required is checked and the field is empty during import:
 *   → product is rejected with message
 *     "Product found in CSV but with incomplete data — field [jsonTag] is empty"
 *
 * When required is unchecked and the field is empty:
 *   → field is imported as ""
 *
 * Validation entry schema saved to backend:
 *   { csvColumn: string, jsonTag: string, required: boolean }
 */

class ValidationUI {

  // ==================== INITIALIZATION ====================

  static init() {
    console.log('[ValidationUI] Initializing...');

    const saveBtn = document.getElementById('saveValidationBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => ValidationUI.saveRules());
    }

    console.log('[ValidationUI] Initialized');
  }

  // ==================== LOAD ====================

  /**
   * Load mapping columns + any previously saved validation rules and render the table.
   * Called every time the user navigates to the Validation tab.
   */
  static async loadFromMapping() {
    console.log('[ValidationUI] Loading from mapping config...');

    let appConfig = null;

    try {
      const response = await fetch('/api/config/load');
      const data = await response.json();

      if (data.status === 'SUCCESS' && data.config) {
        appConfig = data.config;
      }
    } catch (err) {
      console.error('[ValidationUI] Could not reach backend:', err);
      ValidationUI.showPlaceholder('Cannot reach the server. Is it running?');
      return false;
    }

    // Only show included mapping fields
    const mapping = (appConfig?.mapping || []).filter(m => m.include !== false);

    if (mapping.length === 0) {
      ValidationUI.showPlaceholder(
        'No mapping configured. Save the Mapping tab first.'
      );
      return false;
    }

    // Build lookup of previously saved validation rules by csvColumn
    const savedRules = {};
    (appConfig.validation || []).forEach(r => {
      savedRules[r.csvColumn] = r;
    });

    // Render table
    const tbody = document.getElementById('validationBody');
    tbody.innerHTML = '';

    mapping.forEach(m => {
      const saved    = savedRules[m.csvColumn];
      const required = saved ? saved.required : false;

      const row = document.createElement('tr');
      row.dataset.csvColumn = m.csvColumn;
      row.dataset.jsonTag   = m.jsonTag;

      row.innerHTML = `
        <td><span class="validation-csv-col">${ValidationUI._esc(m.csvColumn)}</span></td>
        <td><span class="validation-json-tag">${ValidationUI._esc(m.jsonTag)}</span></td>
        <td class="validation-required-cell">
          <input type="checkbox" class="validation-required-chk" ${required ? 'checked' : ''}>
        </td>
      `;

      tbody.appendChild(row);
    });

    console.log(`[ValidationUI] Table populated with ${mapping.length} rows`);

    // Restore status badge
    if (appConfig.validation && appConfig.validation.length > 0) {
      ValidationUI._setStatus('SAVED', 'saved');
    } else {
      ValidationUI._setStatus('NOT SAVED', 'idle');
    }

    return true;
  }

  // ==================== ACTIONS ====================

  /**
   * Collect the table and POST validation rules to /api/config/save.
   */
  static async saveRules() {
    const saveBtn = document.getElementById('saveValidationBtn');

    try {
      ValidationUI._setStatus('SAVING...', 'saving');
      if (saveBtn) saveBtn.disabled = true;

      const rows = document.querySelectorAll('#validationBody tr[data-csv-column]');

      if (rows.length === 0) {
        ValidationUI._setStatus('NO COLUMNS', 'error');
        return;
      }

      const validation = [];
      rows.forEach(row => {
        const csvColumn = row.dataset.csvColumn;
        const jsonTag   = row.dataset.jsonTag;
        const required  = row.querySelector('.validation-required-chk')?.checked ?? false;
        validation.push({ csvColumn, jsonTag, required });
      });

      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ validation })
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        ValidationUI._setStatus('SAVED', 'saved');
        console.log('[ValidationUI] Validation rules saved:', validation);
      } else {
        ValidationUI._setStatus('SAVE ERROR', 'error');
        console.error('[ValidationUI] Backend error:', data);
      }

    } catch (err) {
      console.error('[ValidationUI] Save error:', err);
      ValidationUI._setStatus('SAVE ERROR', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ==================== HELPERS ====================

  static _setStatus(text, state) {
    const el = document.getElementById('validationStatus');
    if (!el) return;
    el.textContent = `VALIDATION: ${text}`;
    el.className   = `validation-status validation-status--${state}`;
  }

  static showPlaceholder(message) {
    const tbody = document.getElementById('validationBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="validation-placeholder">${ValidationUI._esc(message)}</td>
        </tr>
      `;
    }
    ValidationUI._setStatus('NOT CONFIGURED', 'idle');
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
  window.ValidationUI = ValidationUI;
}
