/**
 * PersistenceUI — Manages the Persistence & Sync tab (Tab 5).
 *
 * Settings:
 *   triggerMode: 'auto' | 'manual'
 *     auto   — silently search CSV + validate + import + log on every /api/product/import call
 *     manual — return CONFIRMATION_REQUIRED first; process on second call with confirmed: true
 *
 * Sync Log: read-only paginated table showing every import attempt.
 *   Columns: Timestamp | Product Code | Result | Fields Imported | Error
 *   Fetched from GET /api/sync-log?page=N&limit=20
 *   Never deleted — append-only.
 */

class PersistenceUI {

  static _currentPage = 1;

  // ==================== INITIALIZATION ====================

  static init() {
    console.log('[PersistenceUI] Initializing...');

    const saveBtn = document.getElementById('savePersistenceBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => PersistenceUI.saveConfig());
    }

    console.log('[PersistenceUI] Initialized');
  }

  // ==================== LOAD ====================

  /**
   * Entry point called whenever the user opens this tab.
   */
  static async load() {
    await PersistenceUI.loadConfig();
    await PersistenceUI.loadLog(1);
  }

  /**
   * Load and render the persistence settings from backend config.
   */
  static async loadConfig() {
    try {
      const response = await fetch('/api/config/load');
      const data     = await response.json();

      if (data.status === 'SUCCESS' && data.config?.persistence) {
        const p           = data.config.persistence;
        const triggerMode = document.getElementById('triggerMode');
        if (triggerMode) triggerMode.value = p.triggerMode || 'auto';
        PersistenceUI._setStatus('SAVED', 'saved');
      }
    } catch (err) {
      console.error('[PersistenceUI] Could not load config:', err);
    }
  }

  // ==================== ACTIONS ====================

  /**
   * Save trigger mode to backend.
   */
  static async saveConfig() {
    const saveBtn = document.getElementById('savePersistenceBtn');

    try {
      PersistenceUI._setStatus('SAVING...', 'saving');
      if (saveBtn) saveBtn.disabled = true;

      const triggerMode = document.getElementById('triggerMode')?.value || 'auto';

      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ persistence: { triggerMode } })
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        PersistenceUI._setStatus('SAVED', 'saved');
        console.log('[PersistenceUI] Persistence config saved, triggerMode:', triggerMode);
      } else {
        PersistenceUI._setStatus('SAVE ERROR', 'error');
        console.error('[PersistenceUI] Backend error:', data);
      }

    } catch (err) {
      console.error('[PersistenceUI] Save error:', err);
      PersistenceUI._setStatus('SAVE ERROR', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ==================== SYNC LOG ====================

  /**
   * Fetch and render a page of the sync log.
   * @param {number} page - 1-based page number
   */
  static async loadLog(page = 1) {
    PersistenceUI._currentPage = page;

    const tbody       = document.getElementById('syncLogBody');
    const paginationEl = document.getElementById('syncLogPagination');

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:var(--muted); padding:20px;">
            Loading…
          </td>
        </tr>
      `;
    }

    try {
      const response = await fetch(`/api/sync-log?page=${page}&limit=20`);
      const data     = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (tbody) {
        if (!data.entries || data.entries.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="5" class="sync-log-empty">No log entries yet.</td>
            </tr>
          `;
        } else {
          tbody.innerHTML = data.entries.map(e => `
            <tr>
              <td class="sync-log-ts">${PersistenceUI._esc(e.timestamp || '')}</td>
              <td class="sync-log-code">${PersistenceUI._esc(e.productCode || '')}</td>
              <td class="sync-log-result sync-log-result--${e.result === 'FOUND' ? 'found' : 'notfound'}">
                ${PersistenceUI._esc(e.result || '')}
              </td>
              <td class="sync-log-fields">
                ${e.fieldsImported !== undefined ? PersistenceUI._esc(String(e.fieldsImported)) : '—'}
              </td>
              <td class="sync-log-error">${PersistenceUI._esc(e.error || '')}</td>
            </tr>
          `).join('');
        }
      }

      if (paginationEl) {
        paginationEl.innerHTML = PersistenceUI._renderPagination(data.page, data.totalPages);
      }

    } catch (err) {
      console.error('[PersistenceUI] Load log error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; color:#fca5a5; padding:20px;">
              Error loading log: ${PersistenceUI._esc(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  // ==================== HELPERS ====================

  static _renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';
    let html = '<div class="sync-log-pagination">';
    if (currentPage > 1) {
      html += `<button type="button" onclick="PersistenceUI.loadLog(${currentPage - 1})">← Prev</button>`;
    }
    html += `<span>Page ${currentPage} of ${totalPages}</span>`;
    if (currentPage < totalPages) {
      html += `<button type="button" onclick="PersistenceUI.loadLog(${currentPage + 1})">Next →</button>`;
    }
    html += '</div>';
    return html;
  }

  static _setStatus(text, state) {
    const el = document.getElementById('persistenceStatus');
    if (!el) return;
    el.textContent = `PERSISTENCE: ${text}`;
    el.className   = `persistence-status persistence-status--${state}`;
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
  window.PersistenceUI = PersistenceUI;
}
