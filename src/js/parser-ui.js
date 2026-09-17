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
   * Initialize parser tab - attach event listeners and load saved configuration
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
      '#parserDelimiter, #parserHasHeader, #parserQuoteChar, #parserEscapeChar, #parserDateFormat, #parserDecimalSeparator, #parserEmptyValue'
    );
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        // If hasHeader changed, update column names
        if (e.target.id === 'parserHasHeader') {
          this.updateColumnNamesForHeaderChange();
        }
        this.resetParserState();
      });
    });

    // Load saved parser configuration from backend
    this.loadAndRenderParserConfig();
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

      if (result.status === 'FAILED' && (!result.fileColumnNames || result.fileColumnNames.length === 0)) {
        this.renderLogs(result.logs);
        this.updateStatusDisplay('FAILED');
        return;
      }

      // Validate user columns against file structure
      // Pass hasHeader to skip name comparison if hasHeader is 'No'
      const columnValidation = this.validateUserColumnsAgainstFile(
        userColumns,
        result.fileColumnNames,
        parserConfig.hasHeader
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

      // Show preview if no column errors; Save only when the whole check is VALID
      if (columnValidation.errors.length === 0) {
        if (saveButton) {
          saveButton.disabled = result.status !== 'VALID';
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
   * Note: Only compares names if hasHeader is 'Yes'
   */
  static validateUserColumnsAgainstFile(userColumns, fileColumns, hasHeader = 'Yes') {
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

      // Only compare column names if hasHeader is 'Yes'
      // If hasHeader is 'No', we use auto-generated names (Column0, Column1, etc.)
      // so comparing names doesn't make sense
      if (hasHeader === 'Yes') {
        const fileColumnName = fileColumns[colIndex];
        if (userCol.name.toLowerCase() !== fileColumnName.toLowerCase()) {
          errors.push(
            `Column "${userCol.name}" at index ${colIndex}: file has "${fileColumnName}"`
          );
        }
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
   * Update column names when hasHeader changes
   * Logic:
   * - If changing to 'No': Generate auto column names based on column index (Column0, Column1, etc.)
   *   and disable editing
   * - If changing to 'Yes': Enable editing for column names
   */
  static updateColumnNamesForHeaderChange() {
    const hasHeader = document.getElementById('parserHasHeader')?.value;
    const columnsBody = document.getElementById('columnsBody');
    
    if (!columnsBody) return;
    
    const rows = columnsBody.querySelectorAll('tr');
    
    if (hasHeader === 'No') {
      // Generate auto column names based on ROW POSITION (Column0, Column1, ...),
      // NOT the column index. The index only selects which CSV column to read.
      rows.forEach((row, position) => {
        const nameInput = row.querySelector('input[type="text"]');
        if (nameInput) {
          nameInput.value = `Column${position}`;
          nameInput.disabled = true;  // Disable editing when auto-generated
        }
      });
      console.log('[ParserUI] Updated column names to auto-generated (Column0, Column1, ...)');
    } else if (hasHeader === 'Yes') {
      // Enable editing for column names
      rows.forEach((row) => {
        const nameInput = row.querySelector('input[type="text"]');
        if (nameInput) {
          // If the name is auto-generated (ColumnX), clear it
          if (nameInput.value.match(/^Column\d+$/)) {
            nameInput.value = '';  // Clear auto-generated names
          }
          nameInput.disabled = false;  // Enable editing
        }
      });
      console.log('[ParserUI] Enabled column name editing - user must enter names manually');
    }
    
    // Update button state
    this.updateCheckButtonState();
  }

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
        return data.config.connection;
      }
      return null;
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
      let icon = 'ℹ';
      if (log.type === 'success') icon = '✔';
      else if (log.type === 'warning') icon = '⚠';
      else if (log.type === 'error') icon = '❌';

      logLines.appendChild(this.createLogLine(log.type, icon, log.message));
    });
  }

  /**
   * Update status display
   */
  static updateStatusDisplay(status) {
    const statusDiv = document.getElementById('parserStatus');
    if (!statusDiv) return;

    let displayStatus = status;
    let cssClass = status.toLowerCase();
    if (status === 'NOT_TESTED') displayStatus = 'NOT TESTED';
    else if (status === 'TESTING') displayStatus = 'TESTING...';
    else if (status === 'SAVED') cssClass = 'valid';
    else if (status === 'SAVE ERROR') { displayStatus = 'SAVE ERROR'; cssClass = 'failed'; }

    statusDiv.textContent = `STATUS: ${displayStatus}`;
    statusDiv.className = `parser-status ${cssClass}`;
  }

  /**
   * Show error message in log
   */
  static showError(message) {
    const logLines = document.getElementById('parserLogLines');
    if (!logLines) return;

    logLines.innerHTML = '';
    logLines.appendChild(this.createLogLine('error', '❌', message));
  }

  /**
   * Línea de log construida con textContent: los mensajes incluyen cabeceras
   * y nombres leídos del CSV y no deben interpretarse como HTML.
   */
  static createLogLine(type, icon, message) {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'log-icon';
    iconSpan.textContent = icon;
    const messageSpan = document.createElement('span');
    messageSpan.className = 'log-message';
    messageSpan.textContent = message;
    line.append(iconSpan, messageSpan);
    return line;
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
        // Read by the configured column index (matches production rowToObject),
        // so the preview honors the user's Column Index — not the original order.
        td.textContent = row[col.index] ?? '';
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
  static async saveParserConfiguration() {
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

    try {

      // Save to backend (config/app-config.json)
      const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('[ParserUI] Parser configuration saved successfully');
        this.updateStatusDisplay('SAVED');

        // Auto-populate Mapping tab from the newly saved parser columns
        if (window.MappingUI) {
          await MappingUI.loadFromParser();
        }
      } else {
        console.error('[ParserUI] Error saving configuration:', result.error);
        this.updateStatusDisplay('SAVE ERROR');
      }
    } catch (error) {
      console.error('[ParserUI] Error saving configuration:', error);
      this.updateStatusDisplay('SAVE ERROR');
    }
  }

  // ==================== COLUMN MANAGEMENT ====================
  /**
   * Crea una fila de la tabla de columnas.
   * Cualquier cambio en la fila invalida el Check anterior (hay que volver a validar).
   */
  static createColumnRow({ name = '', index = 0, dataType = 'String' }, autoNamed) {
    const row = document.createElement('tr');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Column name';
    nameInput.value = name;
    nameInput.disabled = autoNamed;

    const indexInput = document.createElement('input');
    indexInput.type = 'number';
    indexInput.min = '0';
    indexInput.placeholder = 'Index';
    indexInput.value = index;

    const typeSelect = document.createElement('select');
    ['String', 'Number', 'Date'].forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      option.selected = type === dataType;
      typeSelect.appendChild(option);
    });

    const deleteButton = document.createElement('span');
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = '✖';
    deleteButton.addEventListener('click', () => this.removeParserColumn(deleteButton));

    [nameInput, indexInput, typeSelect, deleteButton].forEach(element => {
      const cell = document.createElement('td');
      cell.appendChild(element);
      row.appendChild(cell);
    });

    [nameInput, indexInput, typeSelect].forEach(input => {
      input.addEventListener('input', () => this.onColumnsChanged());
      input.addEventListener('change', () => this.onColumnsChanged());
    });

    return row;
  }

  static onColumnsChanged() {
    this.resetParserState();
    this.updateCheckButtonState();
  }

  /**
   * Add new column row to table
   * If hasHeader='No', automatically generates a unique column name and disables editing
   */
  static addParserColumn() {
    const columnsBody = document.getElementById('columnsBody');
    if (!columnsBody) return;

    const rows = columnsBody.querySelectorAll('tr');
    const isAutoNaming = document.getElementById('parserHasHeader')?.value === 'No';

    // Nombre ColumnN no repetido aunque se hayan borrado filas intermedias
    const usedNumbers = [...rows]
      .map(row => /^Column(\d+)$/.exec(row.querySelector('input[type="text"]')?.value || ''))
      .filter(Boolean)
      .map(match => parseInt(match[1], 10));
    const nextNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : rows.length;

    columnsBody.appendChild(this.createColumnRow(
      { name: isAutoNaming ? `Column${nextNumber}` : '', index: rows.length },
      isAutoNaming
    ));
    this.onColumnsChanged();
  }

  /**
   * Remove column row from table
   */
  static removeParserColumn(button) {
    button.closest('tr').remove();
    this.onColumnsChanged();
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
    const hasHeader = document.getElementById('parserHasHeader')?.value;
    
    // Logic:
    // - If hasHeader = 'No': Enable if connector ready AND has columns
    // - If hasHeader = 'Yes': Enable if connector ready AND all columns have names
    let canCheck = isConnectorReady && hasColumns;
    
    if (hasHeader === 'Yes' && canCheck) {
      // Check if all columns have names
      const columns = this.getUserColumns();
      const allNamed = columns.every(col => col.name && col.name.trim() !== '');
      canCheck = allNamed;
    }
    
    checkButton.disabled = !canCheck;
  }

  /**
   * Check if connector configuration is ready
   */
  static isConnectorReady() {
    const saveDiv = document.getElementById('saveStatus');
    if (!saveDiv) return false;

    // El Check lee el archivo con la conexión GUARDADA: exige que esté guardada
    // y sin cambios pendientes en el formulario ("SAVE: NOT SAVED" también contiene "SAVED")
    return saveDiv.textContent.trim() === 'SAVE: SAVED';
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

  // ==================== LOAD CONFIGURATION ====================
  /**
   * Load saved parser configuration from backend and render in UI
   */
  static async loadAndRenderParserConfig() {
    try {
      console.log('[ParserUI] Loading saved parser configuration...');

      // Load configuration from backend
      const response = await fetch('/api/config/load');
      if (!response.ok) {
        console.log('[ParserUI] No configuration found in backend');
        return false;
      }

      const data = await response.json();
      if (data.status !== 'SUCCESS' || !data.config?.parser) {
        console.log('[ParserUI] No parser configuration found');
        return false;
      }

      const parserConfig = data.config.parser;

      // 1. Render parsing settings
      const delimiterSelect = document.getElementById('parserDelimiter');
      const hasHeaderSelect = document.getElementById('parserHasHeader');
      const quoteCharInput = document.getElementById('parserQuoteChar');
      const escapeCharInput = document.getElementById('parserEscapeChar');

      if (delimiterSelect) {
        delimiterSelect.value = parserConfig.delimiter || ',';
      }

      if (hasHeaderSelect) {
        // hasHeader is saved as the string "Yes"/"No" — compare explicitly,
        // because any non-empty string (incl. "No") is truthy.
        hasHeaderSelect.value = parserConfig.hasHeader === 'No' ? 'No' : 'Yes';
      }

      if (quoteCharInput) {
        quoteCharInput.value = parserConfig.quoteChar || '"';
      }

      if (escapeCharInput) {
        escapeCharInput.value = parserConfig.escapeChar || '"';
      }

      // Load additional parser settings
      const dateFormatInput = document.getElementById('parserDateFormat');
      const decimalSeparatorInput = document.getElementById('parserDecimalSeparator');
      const emptyValueInput = document.getElementById('parserEmptyValue');

      if (dateFormatInput) {
        dateFormatInput.value = parserConfig.dateFormat || '';
      }

      if (decimalSeparatorInput) {
        decimalSeparatorInput.value = parserConfig.decimalSeparator || '';
      }

      if (emptyValueInput) {
        emptyValueInput.value = parserConfig.emptyValue || '';
      }

      console.log('[ParserUI] Parsing settings loaded');

      // 2. Render Expected Columns table
      if (Array.isArray(parserConfig.columns)) {
        const tbody = document.getElementById('columnsBody');
        if (tbody) {
          tbody.innerHTML = '';
          const autoNamed = parserConfig.hasHeader === 'No';
          parserConfig.columns.forEach(col => tbody.appendChild(this.createColumnRow(col, autoNamed)));
        }
      }

      // Re-evaluate the Check button now that columns are loaded
      this.updateCheckButtonState();

      console.log('[ParserUI] Parser configuration rendered successfully');
      return true;

    } catch (error) {
      console.error('[ParserUI] Error loading parser configuration:', error);
      return false;
    }
  }
}

// ==================== INITIALIZATION ====================
// Export to global scope IMMEDIATELY (before DOMContentLoaded)
window.ParserUI = ParserUI;

