/**
 * CSV Utilities - Reusable functions for CSV parsing and searching
 * Used in both testing and production environments
 * 
 * IMPORTANT: All functions now respect configured columns
 * - Only returns columns specified in configuration
 * - Maintains order from Expected Columns table
 * - Applies data type formatting
 */

/**
 * Parse a single CSV line respecting quotes and delimiters
 * 
 * @param {string} line - CSV line to parse
 * @param {string} delimiter - Field delimiter (e.g., ',')
 * @param {string} quoteChar - Quote character (e.g., '"')
 * @param {string} escapeChar - Escape character (e.g., '"')
 * 
 * @returns {Array<string>} Parsed fields
 */
export function parseCSVLine(line, delimiter = ',', quoteChar = '"', escapeChar = '"') {
  if (!line || typeof line !== 'string') {
    return [];
  }

  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes && char === escapeChar && nextChar === quoteChar) {
      // Comilla escapada: "" (escape = comilla) o \" (escape distinto)
      current += quoteChar;
      i++;
    } else if (char === quoteChar) {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse complete CSV content into array of rows
 * 
 * @param {string} content - Complete CSV file content
 * @param {string} delimiter - Field delimiter
 * @param {boolean} hasHeader - Whether first row is header
 * @param {string} quoteChar - Quote character
 * @param {string} escapeChar - Escape character
 * 
 * @returns {Array<Array<string>>} Array of parsed rows
 */
export function parseCSVContent(
  content,
  delimiter = ',',
  hasHeader = true,
  quoteChar = '"',
  escapeChar = '"'
) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split('\n').filter(line => line.trim());
  const rows = [];

  // Skip header if present
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter, quoteChar, escapeChar);
    if (fields.length > 0) {
      rows.push(fields);
    }
  }

  return rows;
}

/**
 * Convierte una fecha según el formato configurado (tokens dd, MM, yyyy, yy)
 * a texto ISO yyyy-MM-dd, sin pasar por Date/zonas horarias.
 * Sin formato solo se acepta ISO. Devuelve null si no encaja.
 */
export function parseDateWithFormat(value, dateFormat = '') {
  const text = String(value).trim();
  const fmt = (dateFormat || 'yyyy-MM-dd').trim();
  const order = [];
  const pattern = fmt
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/yyyy|yy|MM|M|dd|d/g, token => {
      order.push(token[0]);
      if (token === 'yyyy') return '(\\d{4})';
      if (token === 'yy') return '(\\d{2})';
      return '(\\d{1,2})';
    });
  const match = new RegExp(`^${pattern}$`).exec(text);
  if (!match) return null;

  let year, month, day;
  order.forEach((kind, i) => {
    const n = parseInt(match[i + 1], 10);
    if (kind === 'y') year = match[i + 1].length === 2 ? 2000 + n : n;
    if (kind === 'M') month = n;
    if (kind === 'd') day = n;
  });
  if (!year || !month || !day || month > 12 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Format value according to data type and parser settings
 *
 * @param {string} value - Raw value from CSV
 * @param {string} dataType - Data type (String, Number, Date)
 * @param {Object} parserConfig - { decimalSeparator, dateFormat, emptyValue }
 *
 * @returns {string|number} Formatted value
 */
export function formatValue(value, dataType = 'String', parserConfig = {}) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (text === '') return '';

  // "Empty Value Representation": lista separada por comas (p. ej. "NULL, N/A")
  const emptyValues = String(parserConfig.emptyValue || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  if (emptyValues.includes(text)) return '';

  switch (dataType) {
    case 'Number': {
      const decimalSeparator = parserConfig.decimalSeparator || '.';
      let normalized = text.replace(/\s/g, '');
      if (decimalSeparator === ',') {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = normalized.replace(/,/g, '');
      }
      const num = Number(normalized);
      return normalized !== '' && Number.isFinite(num) ? num : text;
    }

    case 'Date':
      return parseDateWithFormat(text, parserConfig.dateFormat) ?? text;

    case 'String':
    default:
      return text;
  }
}

/**
 * Convert CSV row to object using ONLY configured columns
 * 
 * IMPORTANT: This function now filters by configured columns
 * - Only includes columns specified in configuredColumns
 * - Maintains order from configuredColumns array
 * - Applies data type formatting
 * 
 * @param {Array<string>} row - Raw CSV row (all fields)
 * @param {Array<Object>} configuredColumns - Configured columns with {name, index, dataType}
 * 
 * @returns {Object} Object with only configured columns
 */
export function rowToObject(row, configuredColumns, parserConfig = {}) {
  const obj = {};

  if (!Array.isArray(configuredColumns) || configuredColumns.length === 0) {
    console.warn('[rowToObject] No configured columns provided');
    return obj;
  }

  // Iterate in order of configured columns
  configuredColumns.forEach((col) => {
    const colIndex = col.index;
    const colName = col.name;
    const dataType = col.dataType || 'String';

    // Get value from row at specified index
    const rawValue = row[colIndex] || '';
    
    // Format according to data type
    const formattedValue = formatValue(rawValue, dataType, parserConfig);
    
    // Add to object in order
    obj[colName] = formattedValue;
  });

  return obj;
}

/**
 * Search for a product by identifier in rows
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {string} productId - Product identifier to search
 * @param {number} searchColumnIndex - Column index to search in
 * @param {Array<Object>} configuredColumns - Configured columns
 * 
 * @returns {Object} Search result with only configured columns
 */
export function searchProductInRows(rows, productId, searchColumnIndex, configuredColumns, parserConfig = {}) {
  const startTime = Date.now();

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      found: false,
      product: null,
      rowIndex: -1,
      totalRows: 0,
      searchTime: Date.now() - startTime
    };
  }

  if (searchColumnIndex < 0 || searchColumnIndex >= (rows[0]?.length || 0)) {
    return {
      found: false,
      product: null,
      error: `Invalid search column index: ${searchColumnIndex}`,
      rowIndex: -1,
      totalRows: rows.length,
      searchTime: Date.now() - startTime
    };
  }

  // Search for matching row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (searchColumnIndex >= row.length) {
      continue;
    }

    const cellValue = row[searchColumnIndex].toString().trim();
    const searchValue = productId.toString().trim();

    if (cellValue === searchValue) {
      // Convert to object using ONLY configured columns
      const product = rowToObject(row, configuredColumns, parserConfig);

      return {
        found: true,
        product: product,
        rowIndex: i,
        totalRows: rows.length,
        searchTime: Date.now() - startTime
      };
    }
  }

  // Not found
  return {
    found: false,
    product: null,
    rowIndex: -1,
    totalRows: rows.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Search for a product with advanced criteria
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Object} criteria - Search criteria {columnIndex, value, operator}
 * @param {Array<Object>} configuredColumns - Configured columns
 * 
 * @returns {Object} Search result
 */
export function searchProductAdvanced(rows, criteria, configuredColumns, parserConfig = {}) {
  const startTime = Date.now();

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      found: false,
      product: null,
      rowIndex: -1,
      totalRows: 0,
      searchTime: Date.now() - startTime
    };
  }

  const { columnIndex, value, operator = 'equals' } = criteria;

  if (columnIndex < 0 || columnIndex >= (rows[0]?.length || 0)) {
    return {
      found: false,
      product: null,
      error: `Invalid search column index: ${columnIndex}`,
      rowIndex: -1,
      totalRows: rows.length,
      searchTime: Date.now() - startTime
    };
  }

  // Search with operator
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (columnIndex >= row.length) {
      continue;
    }

    const cellValue = row[columnIndex].toString().trim();
    const searchValue = value.toString().trim();
    let matches = false;

    switch (operator) {
      case 'equals':
        matches = cellValue === searchValue;
        break;
      case 'contains':
        matches = cellValue.includes(searchValue);
        break;
      case 'startsWith':
        matches = cellValue.startsWith(searchValue);
        break;
      case 'endsWith':
        matches = cellValue.endsWith(searchValue);
        break;
      case 'greaterThan':
        matches = parseFloat(cellValue) > parseFloat(searchValue);
        break;
      case 'lessThan':
        matches = parseFloat(cellValue) < parseFloat(searchValue);
        break;
      default:
        matches = cellValue === searchValue;
    }

    if (matches) {
      const product = rowToObject(row, configuredColumns, parserConfig);

      return {
        found: true,
        product: product,
        rowIndex: i,
        totalRows: rows.length,
        searchTime: Date.now() - startTime
      };
    }
  }

  return {
    found: false,
    product: null,
    rowIndex: -1,
    totalRows: rows.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Search for multiple products
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<string>} productIds - Product IDs to search
 * @param {number} searchColumnIndex - Column index to search in
 * @param {Array<Object>} configuredColumns - Configured columns
 * 
 * @returns {Object} Search results
 */
export function searchMultipleProducts(rows, productIds, searchColumnIndex, configuredColumns, parserConfig = {}) {
  const startTime = Date.now();
  const results = [];

  if (!Array.isArray(productIds)) {
    return {
      found: false,
      products: [],
      totalFound: 0,
      totalRows: rows.length,
      searchTime: Date.now() - startTime
    };
  }

  productIds.forEach((productId) => {
    const result = searchProductInRows(rows, productId, searchColumnIndex, configuredColumns, parserConfig);
    if (result.found) {
      results.push(result);
    }
  });

  return {
    found: results.length > 0,
    products: results,
    totalFound: results.length,
    totalRows: rows.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Filter products by criteria
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Object} filterCriteria - Filter criteria
 * @param {Array<Object>} configuredColumns - Configured columns
 * 
 * @returns {Object} Filtered results
 */
export function filterProducts(rows, filterCriteria, configuredColumns, parserConfig = {}) {
  const startTime = Date.now();
  const results = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      products: [],
      totalFound: 0,
      totalRows: 0,
      searchTime: Date.now() - startTime
    };
  }

  rows.forEach((row, idx) => {
    let matches = true;

    for (const [columnIndex, value] of Object.entries(filterCriteria)) {
      const colIdx = parseInt(columnIndex);
      if (colIdx >= row.length || row[colIdx].toString().trim() !== value.toString().trim()) {
        matches = false;
        break;
      }
    }

    if (matches) {
      results.push({
        product: rowToObject(row, configuredColumns, parserConfig),
        rowIndex: idx
      });
    }
  });

  return {
    products: results,
    totalFound: results.length,
    totalRows: rows.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Get all products
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<Object>} configuredColumns - Configured columns
 * 
 * @returns {Object} All products
 */
export function getAllProducts(rows, configuredColumns, parserConfig = {}) {
  const startTime = Date.now();
  const results = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      products: [],
      totalFound: 0,
      totalRows: 0,
      searchTime: Date.now() - startTime
    };
  }

  rows.forEach((row, idx) => {
    results.push({
      product: rowToObject(row, configuredColumns, parserConfig),
      rowIndex: idx
    });
  });

  return {
    products: results,
    totalFound: results.length,
    totalRows: rows.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Get CSV statistics
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<Object>} configuredColumns - Configured columns
 * 
 * @returns {Object} Statistics
 */
export function getCSVStatistics(rows, configuredColumns) {
  return {
    totalRows: rows.length,
    totalColumns: rows.length > 0 ? rows[0].length : 0,
    configuredColumns: configuredColumns.length,
    columnNames: configuredColumns.map(c => c.name),
    columnIndices: configuredColumns.map(c => c.index),
    dataTypes: configuredColumns.map(c => c.dataType)
  };
}
