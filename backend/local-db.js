/**
 * local-db.js — JSON-file-based storage for sync log and products cache.
 * No external npm dependencies — only Node built-ins.
 *
 * Files:
 *   data/sync-log.json   — array of log entries (se archiva al superar el tamaño máximo)
 *   data/products.json   — key/value cache keyed by productCode
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DATA_DIR       = join(__dirname, '..', 'data');
const SYNC_LOG_FILE  = join(DATA_DIR, 'sync-log.json');
const PRODUCTS_FILE  = join(DATA_DIR, 'products.json');

// Al superar este tamaño, el log actual se archiva (sync-log.<fecha>.json) y se empieza uno nuevo
const SYNC_LOG_MAX_BYTES = 5 * 1024 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Lee un JSON. Si está corrupto NO se sobrescribe con el valor por defecto:
 * se aparta como <archivo>.corrupt-<fecha> para no perder el historial.
 */
function readJsonFile(filePath, defaultValue) {
  if (!existsSync(filePath)) return defaultValue;
  const raw = readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    const corruptPath = `${filePath}.corrupt-${stamp()}`;
    renameSync(filePath, corruptPath);
    console.error(`[local-db] Corrupted JSON moved to ${corruptPath}`);
    return defaultValue;
  }
}

/** Escritura atómica: un corte a mitad no deja el archivo truncado. */
function writeJsonFile(filePath, data) {
  ensureDataDir();
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, filePath);
}

function rotateSyncLogIfNeeded() {
  if (!existsSync(SYNC_LOG_FILE)) return;
  if (statSync(SYNC_LOG_FILE).size < SYNC_LOG_MAX_BYTES) return;
  const archivePath = join(DATA_DIR, `sync-log.${stamp()}.json`);
  renameSync(SYNC_LOG_FILE, archivePath);
  console.log(`[local-db] Sync log archived to ${archivePath}`);
}

// ── Sync Log ──────────────────────────────────────────────────────────────

/**
 * Append one log entry to data/sync-log.json.
 *
 * Expected fields (all optional except timestamp + productCode):
 *   timestamp      — ISO string
 *   productCode    — searched identifier
 *   result         — 'FOUND' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'ERROR'
 *   fields         — mapped product (or null)
 *   error          — error message string (or '')
 *   source         — 'apiResp' for API-RESP imports (absent for CSV)
 */
export function insertSyncLog(entry) {
  ensureDataDir();
  rotateSyncLogIfNeeded();
  const log = readJsonFile(SYNC_LOG_FILE, []);
  log.push({
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    ...entry
  });
  writeJsonFile(SYNC_LOG_FILE, log);
}

/**
 * Return a paginated slice of the sync log, newest entries first.
 *
 * @param {object} opts
 * @param {number} [opts.page=1]   1-based page number
 * @param {number} [opts.limit=20] entries per page
 * @param {string} [opts.source]   'apiResp' | 'csv' — filtra por origen
 * @returns {{ entries: object[], total: number, page: number, totalPages: number }}
 */
export function getSyncLog({ page = 1, limit = 20, source } = {}) {
  let log = readJsonFile(SYNC_LOG_FILE, []);
  if (source === 'apiResp') log = log.filter(e => e.source === 'apiResp');
  if (source === 'csv')     log = log.filter(e => e.source !== 'apiResp');

  const sorted     = [...log].reverse();          // newest first
  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage   = Math.min(Math.max(1, page), totalPages);
  const start      = (safePage - 1) * limit;
  const entries    = sorted.slice(start, start + limit);
  return { entries, total, page: safePage, totalPages };
}

// ── Products Cache ────────────────────────────────────────────────────────

/**
 * Insert or update a product in data/products.json.
 * Keyed by productCode.
 */
export function upsertProduct({ productCode, data }) {
  ensureDataDir();
  const cache = readJsonFile(PRODUCTS_FILE, {});
  cache[String(productCode)] = {
    ...data,
    _updatedAt: new Date().toISOString()
  };
  writeJsonFile(PRODUCTS_FILE, cache);
}
