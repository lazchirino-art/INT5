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
    const connectorConfig = await this.getConnectorConfig();

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
          message: 'Column validation failed: ' + columnValidation.errors.join(', ')
        });
      }

      // Render logs
      this.renderLogs(finalLogs);
      this.updateStatusDisplay(result.status);

      console.log('[ParserUI] Configuration check completed:', result.status);
    } catch (error) {
      console.error('[ParserUI] Error checking configuration:', error);
      this.showError('Error: ' + error.message);
      this.parserState.status = 'FAILED';
      this.updateStatusDisplay('FAILED');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
      }
    }
  }

  // ==================== CONFIGURATION SAVING ====================
  /**
   * Save parser configuration to backend
   */
  static async saveParserConfiguration() {
    console.log('[ParserUI] Saving configuration...');

    try {
      const config = {
        parser: this.getParserConfig(),
        columns: this.getUserColumns()
      };

      const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        console.log('[ParserUI] Configuration saved successfully');
        this.showSuccess('Configuration saved');
      } else {
        console.error('[ParserUI] Failed to save configuration');
        this.showError('Failed to save configuration');
      }
    } catch (error) {
      console.error('[ParserUI] Error saving configuration:', error);
      this.showError('Error: ' + error.message);
    }
  }

  // ==================== CONFIGURATION RETRIEVAL ====================
  /**
   * Get parser configuration from form inputs
   */
  static getParserConfig() {
    return {
      delimiter: document.getElementById('parserDelimiter')?.value || ',',
      hasHeader: document.getElementById('parserHasHeader')?.value === 'Yes',
      quoteChar: document.getElementById('parserQuoteChar')?.value || '"',
      escapeChar: document.getElementById('parserEscapeChar')?.value || '"',
      dateFormat: document.getElementById('parserDateFormat')?.value || 'yyyy-MM-dd',
      decimalSeparator: document.getElementById('parserDecimalSeparator')?.value || '.',
      emptyValueRepresentation: document.getElementById('parserEmptyValue')?.value || 'NULL'
    };
  }

  /**
   * Get user-defined columns from table
   */
  static getUserColumns() {
    const rows = document.querySelectorAll('#columnsTable tbody tr');
    const columns = [];

    rows.forEach(row => {
      const nameInput = row.querySelector('input[placeholder="Column name"]');
      const indexInput = row.querySelector('input[placeholder="Column index"]');
      const typeSelect = row.querySelector('select');

      if (nameInput?.value) {
        columns.push({
          name: nameInput.value,
          index: indexInput?.value || '',
          type: typeSelect?.value || 'string'
        });
      }
    });

    return columns;
  }

  /**
   * Get connector configuration from backend API
   */
  static async getConnectorConfig() {
    try {
      const response = await fetch('/api/config/load');
      if (!response.ok) {
        console.error('[ParserUI] Failed to load config from backend');
        return null;
      }

      const data = await response.json();
      if (data.status === 'SUCCESS' && data.config?.connection) {
        console.log('[ParserUI] Connector config loaded from backend:', data.config.connection);
        return data.config.connection;
      }
      return null;
    } catch (error) {
      console.error('[ParserUI] Error loading connector config:', error);
      return null;
    }
  }

  // ==================== VALIDATION ====================
  /**
   * Validate user columns against file structure
   */
  static validateUserColumnsAgainstFile(userColumns, fileColumnNames) {
    const errors = [];

    userColumns.forEach(userCol => {
      if (userCol.index && !fileColumnNames.includes(userCol.index)) {
        errors.push(`Column "${userCol.name}" not found in file`);
      }
    });

    return { errors };
  }

  /**
   * Reset parser state
   */
  static resetParserState() {
    this.parserState.status = 'NOT_TESTED';
    this.parserState.errors = [];
    this.parserState.warnings = [];
    this.updateStatusDisplay('TESTED');
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
    const statusEl = document.getElementById('parserStatus');
    if (statusEl) {
      statusEl.textContent = `STATUS: ${status}`;
      statusEl.className = `connection-status ${status.toLowerCase()}`;
    }
  }

  /**
   * Update check button state
   */
  static updateCheckButtonState() {
    const checkButton = document.getElementById('checkConfigButton');
    if (checkButton) {
      const hasColumns = this.getUserColumns().length > 0;
      checkButton.disabled = !hasColumns;
    }
  }

  /**
   * Show error message
   */
  static showError(message) {
    console.error('[ParserUI]', message);
    const logLines = document.getElementById('parserLogLines');
    if (logLines) {
      const errorLine = document.createElement('div');
      errorLine.className = 'log-line log-error';
      errorLine.innerHTML = `<span class="log-icon">❌</span><span class="log-message">${message}</span>`;
      logLines.appendChild(errorLine);
    }
  }

  /**
   * Show success message
   */
  static showSuccess(message) {
    console.log('[ParserUI]', message);
    const logLines = document.getElementById('parserLogLines');
    if (logLines) {
      const successLine = document.createElement('div');
      successLine.className = 'log-line log-success';
      successLine.innerHTML = `<span class="log-icon">✔</span><span class="log-message">${message}</span>`;
      logLines.appendChild(successLine);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ParserUI.init());
} else {
  ParserUI.init();
}
