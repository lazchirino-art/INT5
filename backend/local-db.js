/**
 * local-db.js — JSON-file-based storage for sync log and products cache.
 * No external npm dependencies — only Node built-ins.
 *
 * Files:
 *   data/sync-log.json   — append-only array of log entries (never purged)
 *   data/products.json   — key/value cache keyed by productCode
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DATA_DIR       = join(__dirname, '..', 'data');
const SYNC_LOG_FILE  = join(DATA_DIR, 'sync-log.json');
const PRODUCTS_FILE  = join(DATA_DIR, 'products.json');

// ── Helpers ───────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (!existsSync(filePath)) return defaultValue;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Sync Log ──────────────────────────────────────────────────────────────

/**
 * Append one log entry to data/sync-log.json.
 *
 * Expected fields (all optional except timestamp + productCode):
 *   timestamp      — ISO string
 *   productCode    — searched identifier
 *   result         — 'FOUND' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'ERROR'
 *   fieldsImported — number of mapped fields imported (or 0)
 *   error          — error message string (or '')
 */
export function insertSyncLog(entry) {
  ensureDataDir();
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
 * @returns {{ entries: object[], total: number, page: number, totalPages: number }}
 */
export function getSyncLog({ page = 1, limit = 20 } = {}) {
  const log    = readJsonFile(SYNC_LOG_FILE, []);
  const sorted = [...log].reverse();          // newest first
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
 * Keyed by productCode for O(1) lookup.
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

/**
 * Get a cached product by code.
 * Returns null if not found.
 */
export function getProduct(productCode) {
  const cache = readJsonFile(PRODUCTS_FILE, {});
  return cache[String(productCode)] || null;
}
