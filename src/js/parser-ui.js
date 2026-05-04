/**
 * Parser UI - Handle Parser tab behavior and state
 * Manages CSV parser configuration, validation, and preview
 */

class ParserUI {
  // ==================== STATE ====================
  static parserState = {
    status: 'NOT_TESTED',
    errors: [],
    warnings: [],
    columnNames: [],
    columnCount: 0,
    preview: []
  };

  // ==================== INITIALIZATION ====================
  /**
   * Initialize parser tab - attach event listeners
   */
  static init() {
    const checkButton = document.getElementById('checkConfigButton');
    const saveButton = document.getElementById('saveParserButton');

    if (checkButton) {
      checkButton.addEventListener('click', () => this.checkParserConfiguration());
    }

    if (saveButton) {
      saveButton.addEventListener('click', () => this.saveParserConfiguration());
    }

    // Reset state when parser inputs change
    const inputs = document.querySelectorAll(
      '#parserDelimiter, #parserHasHeader, #parserQuoteChar, #parserEscapeChar'
    );
    inputs.forEach(input => {
      input.addEventListener('change', () => this.resetParserState());
    });

    this.updateCheckButtonState();
  }

  // ==================== CONFIGURATION CHECKING ====================
  /**
   * Check parser configuration against CSV file
   */
  static async checkParserConfiguration() {
    console.log('[ParserUI] Checking configuration...');

    const parserConfig = this.getParserConfig();
    const userColumns = this.getUserColumns();
    const connectorConfig = this.getConnectorConfig();

    // Validation: connector config exists
    if (!connectorConfig) {
      console.error('[ParserUI] No connector config found');
      this.showError('Connector configuration not found');
      return;
    }

    // Validation: at least one column configured
    if (userColumns.length === 0) {
      console.error('[ParserUI] No columns added');
      this.showError('Please add at least one column');
      return;
    }

    this.parserState.status = 'TESTING';
    this.updateStatusDisplay('TESTING');

    const saveButton = document.getElementById('saveParserButton');
    if (saveButton) {
      saveButton.disabled = true;
    }

    try {
      // Call CSV parser validation
      const result = await CSVParser.validateConfiguration(connectorConfig, parserConfig);

      // Update state with parser result
      this.parserState.status = result.status;
      this.parserState.errors = result.errors || [];
      this.parserState.warnings = result.warnings || [];
      this.parserState.columnNames = result.columnNames || [];
      this.parserState.columnCount = result.columnCount || 0;
      this.parserState.preview = result.preview || [];

      // Validate user columns against file structure
      const columnValidation = this.validateUserColumnsAgainstFile(
        userColumns,
        result.fileColumnNames
      );

      // Build final logs
      const finalLogs = [...result.logs];

      // Add column validation errors
      if (columnValidation.errors.length > 0) {
        finalLogs.push({
          type: 'error',
          message: `Column mapping validation failed (${columnValidation.errors.length} errors)`
        });

        columnValidation.errors.forEach(error => {
          finalLogs.push({
            type: 'error',
            message: error
          });
        });

        result.status = 'FAILED';
        this.parserState.status = 'FAILED';
      }

      // Add column validation warnings
      if (columnValidation.warnings.length > 0) {
        finalLogs.push({
          type: 'warning',
          message: `Column mapping warnings (${columnValidation.warnings.length})`
        });

        columnValidation.warnings.forEach(warning => {
          finalLogs.push({
            type: 'warning',
            message: warning
          });
        });
      }

      // Render results
      this.renderLogs(finalLogs);
      this.updateStatusDisplay(result.status);

      // Debug logging
      console.log('[ParserUI] Result:', result);
      console.log('[ParserUI] Preview:', result.preview);
      console.log('[ParserUI] FileColumnNames:', result.fileColumnNames);
      console.log('[ParserUI] UserColumns:', userColumns);
      console.log('[ParserUI] ColumnValidation:', columnValidation);

      // Show preview and enable save if no column errors
      if (columnValidation.errors.length === 0) {
        if (saveButton) {
          saveButton.disabled = false;
        }
        if (result.preview && result.preview.length > 0) {
          this.showPreview(result.preview, userColumns);
        }
      } else {
        // Hide preview if there are column errors
        const previewSection = document.getElementById('previewSection');
        if (previewSection) {
          previewSection.style.display = 'none';
        }
        if (saveButton) {
          saveButton.disabled = true;
        }
      }
    } catch (error) {
      console.error('[ParserUI] Error:', error);
      this.showError(`Unexpected error: ${error.message}`);
      this.parserState.status = 'FAILED';
      this.updateStatusDisplay('FAILED');
    }
  }

  // ==================== VALIDATION ====================
  /**
   * Validate user columns against file columns
   * Checks that configured column indices exist in the file
   */
  static validateUserColumnsAgainstFile(userColumns, fileColumns) {
    const errors = [];
    const warnings = [];

    userColumns.forEach((userCol) => {
      const colIndex = parseInt(userCol.index);

      // Check if index is valid
      if (isNaN(colIndex) || colIndex < 0 || colIndex >= fileColumns.length) {
        errors.push(
          `❌ Column "${userCol.name}":\n   Expected index: ${colIndex}\n   Found: "${fileColumns[colIndex] || 'OUT OF RANGE'}"`
        );
        return;
      }

      // Check if column name matches (error if mismatch)
      const fileColumnName = fileColumns[colIndex];
      if (userCol.name.toLowerCase() !== fileColumnName.toLowerCase()) {
        errors.push(
          `Column "${userCol.name}" at index ${colIndex}: file has "${fileColumnName}"`
        );
      }
    });

    return { errors, warnings };
  }

  // ==================== DATA RETRIEVAL ====================
  /**
   * Get user-configured columns from table
   */
  static getUserColumns() {
    const columnsBody = document.getElementById('columnsBody');
    if (!columnsBody) return [];

    const columns = [];
    columnsBody.querySelectorAll('tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input, select');
      if (inputs.length >= 3) {
        const name = inputs[0].value.trim();
        const index = inputs[1].value.trim();
        const dataType = inputs[2].value;

        // Only add if name and index are provided
        if (name && index !== '') {
          columns.push({
            name: name,
            index: parseInt(index),
            dataType: dataType
          });
        }
      }
    });

    return columns;
  }

  /**
   * Get parser configuration from form inputs
   */
  static getParserConfig() {
    return {
      delimiter: document.getElementById('parserDelimiter')?.value || ',',
      hasHeader: document.getElementById('parserHasHeader')?.value || 'Yes',
      quoteChar: document.getElementById('parserQuoteChar')?.value || '"',
      escapeChar: document.getElementById('parserEscapeChar')?.value || '"',
      dateFormat: document.getElementById('parserDateFormat')?.value || '',
      decimalSeparator: document.getElementById('parserDecimalSeparator')?.value || '',
      emptyValue: document.getElementById('parserEmptyValue')?.value || '',
      columns: this.getUserColumns()
    };
  }

  /**
   * Get connector configuration from localStorage
   */
  static getConnectorConfig() {
    try {
      const stored = localStorage.getItem('menuCsvInt.connectionConfig');
      if (!stored) return null;

      const config = JSON.parse(stored);
      return config.connection;
    } catch (error) {
      console.error('[ParserUI] Error loading connector config:', error);
      return null;
    }
  }

  // ==================== UI RENDERING ====================
  /**
   * Render validation logs
   */
  static renderLogs(logs) {
    const logLines = document.getElementById('parserLogLines');
    if (!logLines) return;

    logLines.innerHTML = '';

    logs.forEach(log => {
      const line = document.createElement('div');
      line.className = `log-line log-${log.type}`;

      // Select icon based on log type
      let icon = '';
      if (log.type === 'success') icon = '✔';
      else if (log.type === 'warning') icon = '⚠';
      else if (log.type === 'error') icon = '❌';
      else icon = 'ℹ';

      line.innerHTML = `<span class="log-icon">${icon}</span><span class="log-message">${log.message}</span>`;
      logLines.appendChild(line);
    });
  }

  /**
   * Update status display
   */
  static updateStatusDisplay(status) {
    const statusDiv = document.getElementById('parserStatus');
    if (!statusDiv) return;

    let displayStatus = status;
    if (status === 'NOT_TESTED') displayStatus = 'NOT TESTED';
    else if (status === 'TESTING') displayStatus = 'TESTING...';

    statusDiv.textContent = `STATUS: ${displayStatus}`;
    statusDiv.className = `parser-status ${status.toLowerCase()}`;
  }

  /**
   * Show error message in log
   */
  static showError(message) {
    const logLines = document.getElementById('parserLogLines');
    if (!logLines) return;

    logLines.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'log-line log-error';
    line.innerHTML = `<span class="log-icon">❌</span><span class="log-message">${message}</span>`;
    logLines.appendChild(line);
  }

  /**
   * Show preview table with data
   * Only shows configured columns and limits to 5 rows
   */
  static showPreview(preview, userColumns) {
    const previewSection = document.getElementById('previewSection');
    if (!previewSection) return;

    // Only show if there are user columns configured
    if (!userColumns || userColumns.length === 0) {
      previewSection.style.display = 'none';
      return;
    }

    if (!preview || preview.length === 0) {
      previewSection.style.display = 'none';
      return;
    }

    previewSection.style.display = 'block';

    const table = document.getElementById('previewTable');
    if (!table) return;

    table.innerHTML = '';

    // Create header with only configured columns
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    userColumns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.name;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body with only first 5 rows and configured columns
    const tbody = document.createElement('tbody');
    const maxRows = Math.min(5, preview.length);
    for (let i = 0; i < maxRows; i++) {
      const row = preview[i];
      const tr = document.createElement('tr');
      userColumns.forEach(col => {
        const td = document.createElement('td');
        td.textContent = row[col.name] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }


  // ==================== PERSISTENCE ====================
  /**
   * Save parser configuration to localStorage
   */
  static saveParserConfiguration() {
    if (this.parserState.status !== 'VALID') {
      alert('Configuration is not valid');
      return;
    }

    const config = {
      parser: {
        ...this.getParserConfig(),
        columns: this.getUserColumns()
      }
    };

    localStorage.setItem('menuCsvInt.parserConfig', JSON.stringify(config));
    alert('Parser configuration saved');
  }

  // ==================== COLUMN MANAGEMENT ====================
  /**
   * Add new column row to table
   */
  static addParserColumn() {
    const columnsBody = document.getElementById('columnsBody');
    if (!columnsBody) return;

    // Calculate next index based on current row count
    const rowCount = columnsBody.querySelectorAll('tr').length;
    const nextIndex = rowCount;

    // Create new row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" placeholder="Column name" /></td>
      <td><input type="number" min="0" value="${nextIndex}" placeholder="Index" /></td>
      <td><select>
        <option value="String">String</option>
        <option value="Number">Number</option>
        <option value="Date">Date</option>
      </select></td>
      <td><span class="delete-btn" onclick="ParserUI.removeParserColumn(this)">✖</span></td>
    `;
    columnsBody.appendChild(row);

    // Add listeners to update button state on input change
    const inputs = row.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.updateCheckButtonState());
      input.addEventListener('change', () => this.updateCheckButtonState());
    });

    this.updateCheckButtonState();
  }

  /**
   * Remove column row from table
   */
  static removeParserColumn(button) {
    button.closest('tr').remove();
    this.updateCheckButtonState();
  }

  // ==================== BUTTON STATE ====================
  /**
   * Update check button enabled/disabled state
   * Button is enabled only if connector is ready AND at least one column exists
   */
  static updateCheckButtonState() {
    const checkButton = document.getElementById('checkConfigButton');
    if (!checkButton) return;

    const isConnectorReady = this.isConnectorReady();
    const hasColumns = this.getUserColumns().length > 0;

    checkButton.disabled = !(isConnectorReady && hasColumns);
  }

  /**
   * Check if connector configuration is ready
   */
  static isConnectorReady() {
    const statusDiv = document.getElementById('connectionStatus');
    const saveDiv = document.getElementById('saveStatus');

    if (!statusDiv || !saveDiv) return false;

    const statusText = statusDiv.textContent;
    const saveText = saveDiv.textContent;

    return statusText.includes('READY') && saveText.includes('SAVED');
  }

  // ==================== STATE MANAGEMENT ====================
  /**
   * Reset parser state when inputs change
   */
  static resetParserState() {
    this.parserState.status = 'NOT_TESTED';
    this.parserState.errors = [];
    this.parserState.warnings = [];

    this.updateStatusDisplay('NOT_TESTED');

    // Clear logs
    const logLines = document.getElementById('parserLogLines');
    if (logLines) {
      logLines.innerHTML = '';
    }

    // Hide preview
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
      previewSection.style.display = 'none';
    }

    // Disable save button
    const saveButton = document.getElementById('saveParserButton');
    if (saveButton) {
      saveButton.disabled = true;
    }
  }
}

// ==================== INITIALIZATION ====================
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  ParserUI.init();
});

// Export to global scope
window.ParserUI = ParserUI;
