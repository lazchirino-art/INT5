/**
 * api-resp-handler.js — HTTP client for external REST API integrations.
 *
 * Responsibilities:
 *   - Build request URL replacing {productCode} placeholder
 *   - Attach authentication headers (none / apiKey / bearer / basic)
 *   - Make the HTTP request and return parsed JSON
 *   - Extract all field paths from a JSON object (for schema detection)
 *   - Get a value from a JSON object by dot-path
 */

/**
 * Fetch a product from an external REST API.
 *
 * @param {object} connector  — saved apiResp.connector config
 * @param {string} productCode
 * @returns {object} parsed JSON response
 * @throws {Error} on HTTP error or network failure
 */
export async function fetchProduct(connector, productCode) {
  const {
    baseUrl      = '',
    path         = '',
    method       = 'GET',
    bodyTemplate = '',
    authType     = 'none',
    apiKeyHeader = '',
    apiKeyValue  = '',
    bearerToken  = '',
    basicUsername = '',
    basicPassword = ''
  } = connector;

  const resolvedPath = path.replace(/\{productCode\}/g, encodeURIComponent(productCode));
  const url = baseUrl.replace(/\/$/, '') + resolvedPath;

  const headers = {
    'Accept':       'application/json',
    'Content-Type': 'application/json'
  };

  if (authType === 'apiKey' && apiKeyHeader) {
    headers[apiKeyHeader] = apiKeyValue;
  } else if (authType === 'bearer' && bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  } else if (authType === 'basic' && basicUsername) {
    const encoded = Buffer.from(`${basicUsername}:${basicPassword}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  }

  const options = { method: method.toUpperCase(), headers };

  if (method.toUpperCase() === 'POST' && bodyTemplate) {
    options.body = bodyTemplate.replace(/\{productCode\}/g, productCode);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API responded with ${response.status} ${response.statusText} — URL: ${url}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`API returned non-JSON response (${contentType}): ${text.slice(0, 200)}`);
  }

  return await response.json();
}

/**
 * Recursively extract all leaf field paths from a JSON object.
 * Arrays are skipped (takes first element if it's an object).
 *
 * @param {object} json
 * @param {string} prefix
 * @returns {{ path: string, value: string }[]}
 */
export function extractFields(json, prefix = '') {
  if (!json || typeof json !== 'object') return [];

  const fields = [];

  for (const [key, value] of Object.entries(json)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      // For arrays, take first element if it's an object
      if (value.length > 0 && value[0] !== null && typeof value[0] === 'object') {
        fields.push(...extractFields(value[0], `${fieldPath}[0]`));
      } else {
        fields.push({ path: fieldPath, value: JSON.stringify(value).slice(0, 60) });
      }
    } else if (value !== null && typeof value === 'object') {
      fields.push(...extractFields(value, fieldPath));
    } else {
      fields.push({ path: fieldPath, value: String(value ?? '') });
    }
  }

  return fields;
}

/**
 * Get a value from a nested JSON object using dot-path notation.
 * Supports: "name", "product.name", "product.details.dose"
 *
 * @param {object} obj
 * @param {string} path
 * @returns {*} the value, or undefined if not found
 */
export function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    // Handle array notation e.g. items[0]
    const arrMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrMatch) {
      return acc[arrMatch[1]]?.[parseInt(arrMatch[2], 10)];
    }
    return acc[key];
  }, obj);
}
