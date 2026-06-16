/**
 * ApiRespPersistenceUI — Tab 5: Persistence for API-RESP integration.
 *
 * Trigger modes: auto | manual
 * Sync log shows entries with source === 'apiResp'.
 *
 * Config saved under apiResp.persistence.
 * Log read from GET /api/sync-log (filtered client-side by source).
 */

class ApiRespPersistenceUI {

  static _currentPage = 1;

  static init() {
    const saveBtn    = document.getElementById('arSavePersistenceBtn');
    const refreshBtn = document.getElementById('arSyncLogRefresh');
    if (saveBtn)    saveBtn.addEventListener('click',   () => ApiRespPersistenceUI.saveConfig());
    if (refreshBtn) refreshBtn.addEventListener('click', () => ApiRespPersistenceUI.loadLog(1));
    console.log('[ApiRespPersistenceUI] Initialized');
  }

  static async load() {
    await Promise.all([
      ApiRespPersistenceUI.loadConfig(),
      ApiRespPersistenceUI.loadLog(1)
    ]);
  }

  static async loadConfig() {
    try {
      const response = await fetch('/api/config/load');
      const data     = await response.json();
      const p = data?.config?.apiResp?.persistence;
      if (p?.triggerMode) {
        document.getElementById('arTriggerMode').value = p.triggerMode;
      }
      ApiRespPersistenceUI._setStatus('SAVED', 'saved');
    } catch (err) {
      ApiRespPersistenceUI._setStatus('LOAD ERROR', 'error');
    }
  }

  static async saveConfig() {
    const saveBtn = document.getElementById('arSavePersistenceBtn');
    try {
      ApiRespPersistenceUI._setStatus('SAVING...', 'saving');
      if (saveBtn) saveBtn.disabled = true;

      const triggerMode = document.getElementById('arTriggerMode').value;

      const response = await fetch('/api/config/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiResp: { persistence: { triggerMode } } })
      });

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        ApiRespPersistenceUI._setStatus('SAVED', 'saved');
      } else {
        ApiRespPersistenceUI._setStatus('SAVE ERROR', 'error');
      }
    } catch (err) {
      ApiRespPersistenceUI._setStatus('SAVE ERROR', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  static async loadLog(page = 1) {
    ApiRespPersistenceUI._currentPage = page;
    const tbody = document.getElementById('arSyncLogBody');
    const pag   = document.getElementById('arSyncLogPagination');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="sync-log-empty">Loading...</td></tr>';

    try {
      const limit    = 20;
      const response = await fetch(`/api/sync-log?page=${page}&limit=${limit}`);
      const data     = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Filter client-side to show only apiResp entries
      const entries = (data.entries || []).filter(e => e.source === 'apiResp');

      if (entries.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="sync-log-empty">No API-RESP sync log entries yet.</td></tr>';
        if (pag)   pag.innerHTML  = '';
        return;
      }

      if (tbody) {
        tbody.innerHTML = entries.map(e => {
          const ts      = new Date(e.timestamp).toLocaleString();
          const result  = e.result || 'UNKNOWN';
          const cls     = result === 'FOUND'     ? 'sync-log-result--found'
                        : result === 'NOT_FOUND' ? 'sync-log-result--notfound'
                        : '';
          const errCell = e.error ? `<span class="sync-log-error">${ApiRespPersistenceUI._esc(e.error)}</span>` : '—';
          const fields  = e.fields ? Object.entries(e.fields).map(([k,v]) => `${k}: ${v}`).join(', ') : '—';

          return `<tr>
            <td class="sync-log-ts">${ApiRespPersistenceUI._esc(ts)}</td>
            <td class="sync-log-code">${ApiRespPersistenceUI._esc(e.productCode || '')}</td>
            <td class="${cls}">${ApiRespPersistenceUI._esc(result)}</td>
            <td class="sync-log-fields">${ApiRespPersistenceUI._esc(fields)}</td>
            <td>${errCell}</td>
          </tr>`;
        }).join('');
      }

      if (pag) {
        const hasPrev = page > 1;
        const hasNext = (data.entries || []).length >= limit;
        pag.innerHTML = `
          ${hasPrev ? `<button class="sync-log-pagination-btn" onclick="ApiRespPersistenceUI.loadLog(${page - 1})">← Prev</button>` : ''}
          <span>Page ${page}</span>
          ${hasNext ? `<button class="sync-log-pagination-btn" onclick="ApiRespPersistenceUI.loadLog(${page + 1})">Next →</button>` : ''}
        `;
      }
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="sync-log-empty">${ApiRespPersistenceUI._esc(err.message)}</td></tr>`;
    }
  }

  static _setStatus(text, state) {
    const el = document.getElementById('arPersistenceStatus');
    if (!el) return;
    el.textContent = `PERSISTENCE: ${text}`;
    el.className   = `persistence-status persistence-status--${state}`;
  }

  static _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

if (typeof window !== 'undefined') window.ApiRespPersistenceUI = ApiRespPersistenceUI;
