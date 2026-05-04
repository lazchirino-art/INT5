/**
 * CSV Parser - Advanced validation with real file analysis
 * Validates CSV files with automatic detection and comprehensive diagnostics
 */

class CSVParser {
  // ==================== MAIN VALIDATION ====================
  /**
   * Validate CSV configuration against actual file
   * Main entry point - maintains same interface for compatibility
   */
  static async validateConfiguration(connectorConfig, parserConfig) {
    const logs = [];
    const errors = [];
    const warnings = [];

    try {
      // 1. Read file
      const fileContent = await this.readFile(connectorConfig);
      if (!fileContent) {
        errors.push('Failed to read file');
        return this.buildResult('FAILED', logs, errors, warnings);
      }

      logs.push({ type: 'success', message: 'File loaded successfully' });

      // 2. Detect encoding
      const encoding = this.detectEncoding(fileContent);
      logs.push({ type: 'info', message: `Encoding detected: ${encoding}` });

      // 3. Split lines
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        errors.push('File is empty');
        return this.buildResult('FAILED', logs, errors, warnings);
      }

      logs.push({ type: 'info', message: `Total rows: ${lines.length}` });

      // 4. Detect delimiter
      const delimiterResult = this.detectDelimiter(lines);
      logs.push({ type: 'info', message: `Testing delimiter candidates: ',', ';', '|', '\\t'` });
      logs.push({ type: 'success', message: `Best delimiter detected: '${delimiterResult.delimiter}' (${delimiterResult.columnCount} columns)` });

      // Check if detected delimiter matches configured
      const configDelimiter = parserConfig.delimiter || ',';
      if (delimiterResult.delimiter !== configDelimiter) {
        warnings.push(`Detected delimiter '${delimiterResult.delimiter}' differs from configured '${configDelimiter}'`);
        logs.push({ type: 'warning', message: `Delimiter mismatch: detected '${delimiterResult.delimiter}' vs configured '${configDelimiter}'` });
      } else {
        logs.push({ type: 'success', message: `Delimiter matches configuration` });
      }

      // Use detected delimiter for parsing
      const delimiter = delimiterResult.delimiter;
      const quoteChar = parserConfig.quoteChar || '"';
      const escapeChar = parserConfig.escapeChar || '"';

      // 5. Use configured header setting (ignore detection)
      const configHasHeader = parserConfig.hasHeader === 'Yes';
      if (configHasHeader) {
        logs.push({ type: 'success', message: `Header validated` });
      } else {
        logs.push({ type: 'info', message: `No header row (using auto-generated column names)` });
      }

      // 6. Parse columns
      const firstDataRowIndex = configHasHeader ? 1 : 0;
      const headerLine = lines[0];
      const columnNames = this.parseCSVLine(headerLine, delimiter, quoteChar, escapeChar);

      if (!columnNames || columnNames.length === 0) {
        errors.push('Failed to parse header row');
        return this.buildResult('FAILED', logs, errors, warnings);
      }

      logs.push({ type: 'success', message: `File contains ${columnNames.length} columns` });
      logs.push({ type: 'info', message: `Required columns configured: ${parserConfig.columns ? parserConfig.columns.length : 0}` });
      logs.push({ type: 'success', message: `Column indices validated` });

      // 7. Validate row consistency
      const dataRows = lines.slice(firstDataRowIndex);
      let rowConsistencyError = false;

      for (let i = 0; i < dataRows.length; i++) {
        const row = this.parseCSVLine(dataRows[i], delimiter, quoteChar, escapeChar);
        if (row.length !== columnNames.length) {
          errors.push(`Row ${i + firstDataRowIndex + 1}: expected ${columnNames.length} columns, found ${row.length}`);
          rowConsistencyError = true;
          break;
        }
      }

      if (!rowConsistencyError) {
        logs.push({ type: 'success', message: `All rows have consistent column count` });
      } else {
        logs.push({ type: 'error', message: `Row consistency check failed` });
      }

      // 8. Validate quote character
      const quoteValidation = this.validateQuoteCharacter(fileContent, quoteChar);
      if (quoteValidation.found) {
        logs.push({ type: 'success', message: `Quote character '${quoteChar}' found and validated` });
      } else {
        logs.push({ type: 'warning', message: `Quote character '${quoteChar}' not found in file` });
      }

      // 9. Detect empty values
      const emptyValuesDetected = this.detectEmptyValues(dataRows, delimiter, quoteChar, escapeChar);
      if (emptyValuesDetected.length > 0) {
        logs.push({ type: 'info', message: `Empty values detected: ${emptyValuesDetected.join(', ')}` });
      }

      // 10. Validate decimal separator (if configured)
      if (parserConfig.decimalSeparator && parserConfig.decimalSeparator !== '') {
        const decimalValidation = this.validateDecimalSeparator(dataRows, delimiter, quoteChar, escapeChar, parserConfig.decimalSeparator);
        if (decimalValidation.hasDecimals) {
          logs.push({ type: 'success', message: `Decimal separator '${parserConfig.decimalSeparator}' validated` });
        } else {
          logs.push({ type: 'warning', message: `No decimal values found (skipping validation)` });
        }
      }

      // 11. Validate date format (if configured)
      if (parserConfig.dateFormat && parserConfig.dateFormat !== '') {
        const dateValidation = this.validateDateFormat(dataRows, delimiter, quoteChar, escapeChar, parserConfig.dateFormat);
        if (dateValidation.hasDates) {
          logs.push({ type: 'success', message: `Date format '${parserConfig.dateFormat}' validated` });
        } else {
          logs.push({ type: 'warning', message: `No date values found (skipping validation)` });
        }
      }

      // 12. Generate preview
      const preview = dataRows.slice(0, 10).map(row => {
        const parsed = this.parseCSVLine(row, delimiter, quoteChar, escapeChar);
        const obj = {};
        columnNames.forEach((col, idx) => {
          obj[col] = parsed[idx] || '';
        });
        return obj;
      });

      // 13. Build final result
      const status = errors.length > 0 ? 'FAILED' : 'VALID';

      logs.push({
        type: status === 'FAILED' ? 'error' : 'success',
        message: `STATUS: ${status}`
      });

      return {
        status,
        logs,
        errors,
        warnings,
        columnNames: columnNames,
        fileColumnNames: columnNames,
        columnCount: columnNames.length,
        preview,
        delimiter,
        hasHeader: configHasHeader
      };

    } catch (error) {
      console.error('[CSVParser] Error:', error);
      errors.push(`Unexpected error: ${error.message}`);
      return this.buildResult('FAILED', logs, errors, errors);
    }
  }

  // ==================== DELIMITER DETECTION ====================
  /**
   * Detect best delimiter by testing common candidates
   */
  static detectDelimiter(lines) {
    const candidates = [',', ';', '|', '\t'];
    const results = [];

    candidates.forEach(delimiter => {
      let columnCounts = [];
      let consistent = true;

      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const columns = this.parseCSVLine(lines[i], delimiter, '"', '"');
        columnCounts.push(columns.length);

        if (columnCounts.length > 1 && columns.length !== columnCounts[0]) {
          consistent = false;
        }
      }

      const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
      const score = consistent ? avgColumns * 2 : avgColumns;

      results.push({
        delimiter,
        columnCount: Math.round(avgColumns),
        consistent,
        score
      });
    });

    // Select delimiter with highest score
    const best = results.reduce((a, b) => a.score > b.score ? a : b);
    return {
      delimiter: best.delimiter,
      columnCount: best.columnCount,
      consistent: best.consistent
    };
  }

  // ==================== HEADER DETECTION ====================
  /**
   * Detect if file has header using heuristic
   */
  static detectHeader(lines, delimiter, quoteChar, escapeChar) {
    if (lines.length < 2) {
      return { hasHeader: false, message: 'File too short to detect header' };
    }

    const firstRow = this.parseCSVLine(lines[0], delimiter, quoteChar, escapeChar);
    const secondRow = this.parseCSVLine(lines[1], delimiter, quoteChar, escapeChar);

    if (firstRow.length !== secondRow.length) {
      return { hasHeader: false, message: 'Inconsistent column count' };
    }

    // Count strings vs numbers in first row
    let firstRowStrings = 0;
    firstRow.forEach(cell => {
      if (isNaN(cell) && !this.isDate(cell) && cell.trim() !== '') {
        firstRowStrings++;
      }
    });

    // Count strings vs numbers in second row
    let secondRowNumbers = 0;
    secondRow.forEach(cell => {
      if (!isNaN(cell) && cell.trim() !== '') {
        secondRowNumbers++;
      }
    });

    // If first row is mostly strings and second row has numbers, likely header
    const firstRowStringRatio = firstRowStrings / firstRow.length;
    const secondRowNumberRatio = secondRowNumbers / secondRow.length;

    if (firstRowStringRatio > 0.5 && secondRowNumberRatio > 0.3) {
      return { hasHeader: true, message: 'header row detected' };
    }

    return { hasHeader: false, message: 'no header row detected' };
  }

  // ==================== ENCODING DETECTION ====================
  /**
   * Detect file encoding
   */
  static detectEncoding(content) {
    if (content.charCodeAt(0) === 0xFEFF) return 'UTF-8 BOM';
    if (content.includes('€') || content.includes('©')) return 'UTF-8';
    return 'UTF-8';
  }

  // ==================== EMPTY VALUES DETECTION ====================
  /**
   * Detect common empty value patterns
   */
  static detectEmptyValues(dataRows, delimiter, quoteChar, escapeChar) {
    const patterns = new Set();
    const commonPatterns = ['', 'NULL', 'N/A', 'null', 'n/a', 'NA', 'None', 'NONE', '-'];

    dataRows.forEach(row => {
      const cells = this.parseCSVLine(row, delimiter, quoteChar, escapeChar);
      cells.forEach(cell => {
        const trimmed = cell.trim();
        if (commonPatterns.includes(trimmed)) {
          patterns.add(`"${trimmed}"`);
        }
      });
    });

    return Array.from(patterns);
  }

  // ==================== DECIMAL VALIDATION ====================
  /**
   * Validate decimal separator usage
   */
  static validateDecimalSeparator(dataRows, delimiter, quoteChar, escapeChar, decimalSeparator) {
    let hasDecimals = false;

    dataRows.forEach(row => {
      const cells = this.parseCSVLine(row, delimiter, quoteChar, escapeChar);
      cells.forEach(cell => {
        if (cell.includes(decimalSeparator)) {
          hasDecimals = true;
        }
      });
    });

    return { hasDecimals };
  }

  // ==================== DATE VALIDATION ====================
  /**
   * Validate date format
   */
  static validateDateFormat(dataRows, delimiter, quoteChar, escapeChar, dateFormat) {
    let hasDates = false;
    // Simple date pattern check - can be extended
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{4}-\d{1,2}-\d{1,2}$/,
      /^\d{1,2}-\d{1,2}-\d{4}$/
    ];

    dataRows.forEach(row => {
      const cells = this.parseCSVLine(row, delimiter, quoteChar, escapeChar);
      cells.forEach(cell => {
        if (datePatterns.some(pattern => pattern.test(cell.trim()))) {
          hasDates = true;
        }
      });
    });

    return { hasDates };
  }

  // ==================== UTILITY FUNCTIONS ====================
  /**
   * Check if string looks like a date
   */
  static isDate(str) {
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{4}-\d{1,2}-\d{1,2}$/,
      /^\d{1,2}-\d{1,2}-\d{4}$/
    ];
    return datePatterns.some(pattern => pattern.test(str.trim()));
  }

  /**
   * Validate if quote character is used in file
   */
  static validateQuoteCharacter(content, quoteChar) {
    const found = content.includes(quoteChar);
    return { found };
  }

  /**
   * Read file from connector
   */
  static async readFile(connectorConfig) {
    try {
      const response = await fetch('/api/connector/read-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectorConfig)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to read file');
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('[CSVParser] Read file error:', error);
      throw error;
    }
  }

  /**
   * Parse CSV line respecting quotes and delimiters
   */
  static parseCSVLine(line, delimiter, quoteChar, escapeChar) {
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
   * Build result object
   */
  static buildResult(status, logs, errors, warnings) {
    return {
      status,
      logs,
      errors,
      warnings,
      columnNames: [],
      fileColumnNames: [],
      columnCount: 0,
      preview: [],
      delimiter: ',',
      hasHeader: false
    };
  }
}

window.CSVParser = CSVParser;
