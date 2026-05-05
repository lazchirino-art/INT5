/**
 * CSV Utilities - Reusable functions for CSV parsing and searching
 * Used in both testing and production environments
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

    if (char === quoteChar) {
      if (inQuotes && nextChar === escapeChar) {
        current += quoteChar;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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
 * Extract header row from CSV content
 * 
 * @param {string} content - CSV content
 * @param {string} delimiter - Field delimiter
 * @param {string} quoteChar - Quote character
 * @param {string} escapeChar - Escape character
 * 
 * @returns {Array<string>} Header fields
 */
export function extractHeader(
  content,
  delimiter = ',',
  quoteChar = '"',
  escapeChar = '"'
) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return [];
  }

  return parseCSVLine(lines[0], delimiter, quoteChar, escapeChar);
}

/**
 * Convert row array to object using column names
 * 
 * @param {Array<string>} row - Row data
 * @param {Array<string>} columnNames - Column names
 * 
 * @returns {Object} Row as object
 */
export function rowToObject(row, columnNames) {
  const obj = {};

  columnNames.forEach((colName, idx) => {
    obj[colName] = row[idx] || '';
  });

  return obj;
}

/**
 * Search for a product by identifier in rows
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {string} productId - Product identifier to search
 * @param {number} searchColumnIndex - Column index to search in
 * @param {Array<string>} columnNames - Column names for result object
 * 
 * @returns {Object} Search result
 */
export function searchProductInRows(rows, productId, searchColumnIndex, columnNames) {
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
      const product = rowToObject(row, columnNames);

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
 * Advanced search with multiple criteria
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Object} searchCriteria - Search criteria
 * @param {string} searchCriteria.columnName - Column name to search in
 * @param {string} searchCriteria.value - Value to search for
 * @param {boolean} searchCriteria.exact - Exact match (default: true)
 * @param {boolean} searchCriteria.caseSensitive - Case sensitive (default: false)
 * @param {Array<string>} columnNames - Column names
 * 
 * @returns {Object} Search results
 */
export function searchProductAdvanced(rows, searchCriteria, columnNames) {
  const startTime = Date.now();

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      found: false,
      results: [],
      totalFound: 0,
      searchTime: Date.now() - startTime
    };
  }

  // Find column index by name
  const searchColumnIndex = columnNames.indexOf(searchCriteria.columnName);
  if (searchColumnIndex === -1) {
    return {
      found: false,
      results: [],
      error: `Column "${searchCriteria.columnName}" not found`,
      totalFound: 0,
      searchTime: Date.now() - startTime
    };
  }

  const results = [];
  const searchValue = searchCriteria.value.toString();
  const exact = searchCriteria.exact !== false;
  const caseSensitive = searchCriteria.caseSensitive === true;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (searchColumnIndex >= row.length) {
      continue;
    }

    let cellValue = row[searchColumnIndex].toString();
    let compareValue = searchValue;

    if (!caseSensitive) {
      cellValue = cellValue.toLowerCase();
      compareValue = compareValue.toLowerCase();
    }

    let matches = false;

    if (exact) {
      matches = cellValue.trim() === compareValue.trim();
    } else {
      matches = cellValue.includes(compareValue);
    }

    if (matches) {
      const product = rowToObject(row, columnNames);

      results.push({
        product: product,
        rowIndex: i
      });
    }
  }

  return {
    found: results.length > 0,
    results: results,
    totalFound: results.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Search for multiple products
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<string>} productIds - Product IDs to search
 * @param {number} searchColumnIndex - Column index to search in
 * @param {Array<string>} columnNames - Column names
 * 
 * @returns {Object} Search results
 */
export function searchMultipleProducts(rows, productIds, searchColumnIndex, columnNames) {
  const startTime = Date.now();
  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;

  for (const productId of productIds) {
    const result = searchProductInRows(rows, productId, searchColumnIndex, columnNames);

    if (result.found) {
      foundCount++;
      results.push({
        productId: productId,
        ...result
      });
    } else {
      notFoundCount++;
      results.push({
        productId: productId,
        found: false,
        product: null,
        rowIndex: -1
      });
    }
  }

  return {
    found: foundCount > 0,
    results: results,
    totalFound: foundCount,
    totalNotFound: notFoundCount,
    totalSearched: productIds.length,
    totalSearchTime: Date.now() - startTime
  };
}

/**
 * Filter rows by multiple criteria
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<Object>} filters - Filter criteria
 * @param {string} filters[].columnName - Column to filter
 * @param {string} filters[].value - Value to match
 * @param {string} filters[].operator - Operator (eq, contains, gt, lt, gte, lte)
 * @param {Array<string>} columnNames - Column names
 * @param {number} limit - Maximum results (optional)
 * 
 * @returns {Object} Filtered results
 */
export function filterProducts(rows, filters, columnNames, limit = null) {
  const startTime = Date.now();

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      found: false,
      results: [],
      totalFound: 0,
      filterTime: Date.now() - startTime
    };
  }

  // Validate filters
  const validatedFilters = [];
  for (const filter of filters) {
    const columnIndex = columnNames.indexOf(filter.columnName);
    if (columnIndex === -1) {
      continue; // Skip invalid column
    }

    validatedFilters.push({
      columnIndex: columnIndex,
      value: filter.value.toString(),
      operator: filter.operator || 'eq'
    });
  }

  if (validatedFilters.length === 0) {
    return {
      found: false,
      results: [],
      error: 'No valid filters provided',
      totalFound: 0,
      filterTime: Date.now() - startTime
    };
  }

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let matchesAllFilters = true;

    for (const filter of validatedFilters) {
      if (filter.columnIndex >= row.length) {
        matchesAllFilters = false;
        break;
      }

      const cellValue = row[filter.columnIndex].toString();
      const filterValue = filter.value;

      let matches = false;

      switch (filter.operator) {
        case 'eq':
          matches = cellValue.trim() === filterValue.trim();
          break;
        case 'contains':
          matches = cellValue.toLowerCase().includes(filterValue.toLowerCase());
          break;
        case 'gt':
          matches = parseFloat(cellValue) > parseFloat(filterValue);
          break;
        case 'lt':
          matches = parseFloat(cellValue) < parseFloat(filterValue);
          break;
        case 'gte':
          matches = parseFloat(cellValue) >= parseFloat(filterValue);
          break;
        case 'lte':
          matches = parseFloat(cellValue) <= parseFloat(filterValue);
          break;
        default:
          matches = cellValue === filterValue;
      }

      if (!matches) {
        matchesAllFilters = false;
        break;
      }
    }

    if (matchesAllFilters) {
      const product = rowToObject(row, columnNames);

      results.push({
        product: product,
        rowIndex: i
      });

      if (limit && results.length >= limit) {
        break;
      }
    }
  }

  return {
    found: results.length > 0,
    results: results,
    totalFound: results.length,
    filterTime: Date.now() - startTime
  };
}

/**
 * Get all products as objects
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<string>} columnNames - Column names
 * 
 * @returns {Object} All products
 */
export function getAllProducts(rows, columnNames) {
  const startTime = Date.now();

  const products = rows.map((row, idx) => ({
    product: rowToObject(row, columnNames),
    rowIndex: idx
  }));

  return {
    found: products.length > 0,
    products: products,
    totalProducts: products.length,
    loadTime: Date.now() - startTime
  };
}

/**
 * Create index for fast lookups
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {number} columnIndex - Column to index
 * 
 * @returns {Object} Index map
 */
export function createIndex(rows, columnIndex) {
  const index = {};

  rows.forEach((row, rowIndex) => {
    if (columnIndex < row.length) {
      const key = row[columnIndex].toString().trim();
      index[key] = rowIndex;
    }
  });

  return index;
}

/**
 * Search using index (O(1) lookup)
 * 
 * @param {Object} index - Index map
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {string} productId - Product ID to search
 * @param {Array<string>} columnNames - Column names
 * 
 * @returns {Object} Search result
 */
export function searchWithIndex(index, rows, productId, columnNames) {
  const startTime = Date.now();
  const key = productId.toString().trim();
  const rowIndex = index[key];

  if (rowIndex === undefined) {
    return {
      found: false,
      product: null,
      rowIndex: -1,
      totalRows: rows.length,
      searchTime: Date.now() - startTime
    };
  }

  const row = rows[rowIndex];
  const product = rowToObject(row, columnNames);

  return {
    found: true,
    product: product,
    rowIndex: rowIndex,
    totalRows: rows.length,
    searchTime: Date.now() - startTime
  };
}

/**
 * Validate CSV structure
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<string>} columnNames - Expected column names
 * 
 * @returns {Object} Validation result
 */
export function validateCSVStructure(rows, columnNames) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('CSV has no data rows');
    return { valid: false, errors, warnings };
  }

  if (!Array.isArray(columnNames) || columnNames.length === 0) {
    errors.push('No column names provided');
    return { valid: false, errors, warnings };
  }

  // Check row consistency
  const expectedColumnCount = columnNames.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length !== expectedColumnCount) {
      errors.push(
        `Row ${i}: expected ${expectedColumnCount} columns, found ${row.length}`
      );
    }
  }

  // Check for empty values
  let emptyValueCount = 0;
  for (const row of rows) {
    for (const cell of row) {
      if (!cell || cell.trim() === '') {
        emptyValueCount++;
      }
    }
  }

  if (emptyValueCount > 0) {
    warnings.push(`Found ${emptyValueCount} empty cells`);
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    rowCount: rows.length,
    columnCount: expectedColumnCount,
    emptyValueCount: emptyValueCount
  };
}

/**
 * Get statistics about CSV data
 * 
 * @param {Array<Array<string>>} rows - Parsed CSV rows
 * @param {Array<string>} columnNames - Column names
 * 
 * @returns {Object} Statistics
 */
export function getCSVStatistics(rows, columnNames) {
  const stats = {
    totalRows: rows.length,
    totalColumns: columnNames.length,
    totalCells: rows.length * columnNames.length,
    emptyCount: 0,
    columnStats: {}
  };

  // Initialize column stats
  columnNames.forEach(colName => {
    stats.columnStats[colName] = {
      emptyCount: 0,
      uniqueValues: new Set(),
      minLength: Infinity,
      maxLength: 0
    };
  });

  // Calculate statistics
  for (const row of rows) {
    for (let i = 0; i < columnNames.length; i++) {
      const colName = columnNames[i];
      const cellValue = row[i] || '';

      if (!cellValue || cellValue.trim() === '') {
        stats.emptyCount++;
        stats.columnStats[colName].emptyCount++;
      } else {
        stats.columnStats[colName].uniqueValues.add(cellValue);
        const length = cellValue.length;
        stats.columnStats[colName].minLength = Math.min(
          stats.columnStats[colName].minLength,
          length
        );
        stats.columnStats[colName].maxLength = Math.max(
          stats.columnStats[colName].maxLength,
          length
        );
      }
    }
  }

  // Convert Sets to counts
  columnNames.forEach(colName => {
    stats.columnStats[colName].uniqueCount = stats.columnStats[colName].uniqueValues.size;
    delete stats.columnStats[colName].uniqueValues;
  });

  return stats;
}

export default {
  parseCSVLine,
  parseCSVContent,
  extractHeader,
  rowToObject,
  searchProductInRows,
  searchProductAdvanced,
  searchMultipleProducts,
  filterProducts,
  getAllProducts,
  createIndex,
  searchWithIndex,
  validateCSVStructure,
  getCSVStatistics
};
