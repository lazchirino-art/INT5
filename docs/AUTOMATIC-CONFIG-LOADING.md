# INT5 - Automatic Configuration Loading

## 📋 Tabla de Contenidos

1. [Concepto](#concepto)
2. [Flujo de Inicialización](#flujo-de-inicialización)
3. [Qué Se Carga](#qué-se-carga)
4. [Cómo Funciona](#cómo-funciona)
5. [Ejemplos](#ejemplos)
6. [Verificación](#verificación)
7. [Troubleshooting](#troubleshooting)

---

## Concepto

### El Problema Anterior

**Antes (❌ Incorrecto)**:
```
Usuario abre csv-integration.html
    ↓
Página carga (sin inicialización)
    ↓
Todos los campos vacíos
    ↓
Usuario debe ingresar TODO manualmente
    ↓
Configuración anterior se pierde
```

### La Solución Actual

**Ahora (✅ Correcto)**:
```
Usuario abre csv-integration.html
    ↓
DOMContentLoaded event
    ↓
Inicialización automática
    ↓
Carga configuración del backend
    ↓
Connector tab se llena automáticamente
    ↓
Parser tab se llena automáticamente
    ↓
Usuario ve configuración anterior
    ↓
Puede editar o usar directamente
```

---

## Flujo de Inicialización

### Paso 1: Página Carga

```html
<body>
  ...
  <script src="../js/csv-integration.js"></script>
</body>
```

### Paso 2: DOMContentLoaded Event

```javascript
// En csv-integration.js
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing CSV Integration...');
  
  // Paso 3: Inicializar componentes
  // Paso 4: Cargar configuración
});
```

### Paso 3: Inicializar Componentes

```javascript
// Inicializar NetworkPathClient
initializeNetworkPathClient();

// Inicializar ParserUI
ParserUI.init();
```

### Paso 4: Cargar Configuración

```javascript
// Cargar ambas configuraciones
const configLoaded = await ConfigLoader.loadAndRenderNetworkConfig();

// Esto hace:
// 1. Carga config.connection del backend
// 2. Renderiza Connector tab
// 3. Carga config.parser del backend
// 4. Renderiza Parser tab
```

---

## Qué Se Carga

### Configuración del Connector

**De `config.connection`**:
- ✅ Path (ruta SMB)
- ✅ File Name Pattern (patrón de archivo)
- ✅ Username (usuario)
- ✅ Password (contraseña - desencriptada)
- ✅ Domain (dominio)
- ✅ Checkboxes (Authentication, Domain)

**Renderizado en**:
- Input fields en Connector tab
- Checkboxes habilitados/deshabilitados

---

### Configuración del Parser

**De `config.parser`**:
- ✅ Delimiter (delimitador)
- ✅ hasHeader (tiene header)
- ✅ quoteChar (carácter de comilla)
- ✅ escapeChar (carácter de escape)
- ✅ columns (columnas esperadas)

**Renderizado en**:
- Select fields (delimiter, hasHeader, etc.)
- Tabla Expected Columns con todas las filas

---

## Cómo Funciona

### 1. ConfigLoader.loadAndRenderNetworkConfig()

```javascript
static async loadAndRenderNetworkConfig() {
  // 1. Cargar configuración del backend
  const appConfig = await this.loadPersistedConfiguration();
  
  // 2. Validar que existe
  if (!appConfig?.connection) {
    return false;
  }
  
  // 3. Renderizar Connector tab
  // - Llenar campos de Network Path
  // - Ejecutar UI logic (toggles)
  
  // 4. Cargar Parser también
  const parserLoaded = await ParserUI.loadAndRenderParserConfig();
  
  return true;
}
```

### 2. ParserUI.loadAndRenderParserConfig()

```javascript
static async loadAndRenderParserConfig() {
  // 1. Cargar configuración del backend
  const response = await fetch('/api/config/load');
  const data = await response.json();
  
  // 2. Validar que existe parser config
  if (!data.config?.parser) {
    return false;
  }
  
  // 3. Renderizar parsing settings
  // - delimiter select
  // - hasHeader select
  // - quoteChar input
  // - escapeChar input
  
  // 4. Renderizar Expected Columns table
  // - Limpiar tbody
  // - Iterar sobre columns
  // - Crear fila para cada columna
  // - Llenar name, index, dataType
  
  return true;
}
```

### 3. Renderizado de Expected Columns

```javascript
// Para cada columna en config.parser.columns
parserConfig.columns.forEach((col) => {
  // Crear fila
  const row = document.createElement('tr');
  
  // Llenar datos
  row.innerHTML = `
    <td><input type="text" value="${col.name}"></td>
    <td><input type="number" value="${col.index}"></td>
    <td>
      <select>
        <option value="String" ${col.dataType === 'String' ? 'selected' : ''}>String</option>
        <option value="Date" ${col.dataType === 'Date' ? 'selected' : ''}>Date</option>
        <option value="Number" ${col.dataType === 'Number' ? 'selected' : ''}>Number</option>
      </select>
    </td>
    <td><span class="delete-btn" onclick="removeRow(this)">x</span></td>
  `;
  
  // Agregar a tabla
  tbody.appendChild(row);
});
```

---

## Ejemplos

### Ejemplo 1: Primera Vez (Sin Configuración)

**Archivo**: `config/app-config.json` (no existe)

**Flujo**:
```
1. Usuario abre csv-integration.html
2. DOMContentLoaded fires
3. ConfigLoader.loadAndRenderNetworkConfig() called
4. /api/config/load returns 404 (no config)
5. ConfigLoader retorna false
6. Todos los campos quedan vacíos
7. Usuario comienza a configurar
```

**Console**:
```
[App] Initializing CSV Integration...
[App] Network Path Client initialized
[App] Parser UI initialized
[App] Loading saved configuration...
[ConfigLoader] Attempting to load from backend API...
[ConfigLoader] No configuration found in backend
[App] No saved configuration found - starting fresh
[App] Initialization complete
```

---

### Ejemplo 2: Configuración Guardada

**Archivo**: `config/app-config.json`
```json
{
  "connection": {
    "connectorType": "networkPath",
    "path": "\\\\Laptop-fjiolk7l\\new",
    "fileNamePattern": "*.csv",
    "username": "client",
    "password": "enc:v1:aes-gcm:...",
    "useAuthentication": true,
    "useDomain": false
  },
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "quoteChar": "\"",
    "escapeChar": "\"",
    "columns": [
      {"name": "MedicationName", "index": 0, "dataType": "String"},
      {"name": "Code", "index": 1, "dataType": "String"},
      {"name": "Price", "index": 4, "dataType": "Number"}
    ]
  }
}
```

**Flujo**:
```
1. Usuario abre csv-integration.html
2. DOMContentLoaded fires
3. ConfigLoader.loadAndRenderNetworkConfig() called
4. /api/config/load returns config
5. Connector tab se llena:
   - networkPath = "\\Laptop-fjiolk7l\new"
   - networkFileNamePattern = "*.csv"
   - useNetworkAuthentication = checked
   - networkUsername = "client"
   - networkPassword = "client123" (desencriptada)
6. ParserUI.loadAndRenderParserConfig() called
7. Parser tab se llena:
   - parserDelimiter = ","
   - parserHasHeader = "Yes"
   - parserQuoteChar = "\""
   - parserEscapeChar = "\""
8. Expected Columns table se llena:
   - Fila 1: MedicationName | 0 | String
   - Fila 2: Code | 1 | String
   - Fila 3: Price | 4 | Number
9. Usuario ve todo configurado
```

**Console**:
```
[App] Initializing CSV Integration...
[App] Network Path Client initialized
[App] Parser UI initialized
[App] Loading saved configuration...
[ConfigLoader] Attempting to load from backend API...
[ConfigLoader] Configuration loaded from backend API
[ConfigLoader] Populating Network Path form...
[ConfigLoader] Executing UI toggle functions...
[ConfigLoader] Network Path configuration loaded successfully
[ParserUI] Loading saved parser configuration...
[ParserUI] Parser configuration loaded: {...}
[ParserUI] Parsing settings loaded
[ParserUI] Loaded 3 columns
[ParserUI] Parser configuration rendered successfully
[ConfigLoader] Parser configuration also loaded
[App] Configuration loaded successfully
[App] Initialization complete
```

---

## Verificación

### Verificar que se Carga Automáticamente

1. **Abre la consola del navegador** (F12)

2. **Abre `csv-integration.html`**

3. **Verifica los logs**:
   ```
   [App] Initializing CSV Integration...
   [App] Network Path Client initialized
   [App] Parser UI initialized
   [App] Loading saved configuration...
   [ConfigLoader] Configuration loaded from backend API
   [ParserUI] Loading saved parser configuration...
   [ParserUI] Parser configuration loaded
   [App] Configuration loaded successfully
   [App] Initialization complete
   ```

4. **Verifica que los campos están llenos**:
   - Connector tab: Path, Username, etc.
   - Parser tab: Delimiter, HasHeader, etc.
   - Expected Columns: Tabla con columnas guardadas

### Verificar que se Guarda Correctamente

1. **Edita la configuración**

2. **Click "Save Configuration"** (Connector o Parser)

3. **Recarga la página** (F5)

4. **Verifica que la configuración se mantiene**

---

## Troubleshooting

### Problema 1: Configuración no se carga

**Síntomas**:
- Campos vacíos después de cargar página
- Console muestra "No configuration found"

**Causas**:
- `config/app-config.json` no existe
- Backend no está corriendo
- Configuración no se guardó

**Solución**:
1. Verifica que backend está corriendo: `node server.js`
2. Verifica que `config/app-config.json` existe
3. Guarda configuración nuevamente

---

### Problema 2: Solo se carga Connector, no Parser

**Síntomas**:
- Connector tab se llena
- Parser tab vacío
- Console muestra "No parser configuration found"

**Causas**:
- Parser config no se guardó
- `config.parser` no existe en `app-config.json`

**Solución**:
1. Abre Parser tab
2. Ingresa columnas esperadas
3. Click "Save Configuration"
4. Recarga página

---

### Problema 3: Campos se llenan pero con valores incorrectos

**Síntomas**:
- Campos se llenan pero con datos incorrectos
- Tabla Expected Columns muestra datos raros

**Causas**:
- Configuración guardada está corrupta
- Backend retorna datos incorrectos

**Solución**:
1. Verifica `config/app-config.json` en servidor
2. Verifica estructura JSON es correcta
3. Borra config y guarda nuevamente

---

### Problema 4: Contraseña no se desencripta

**Síntomas**:
- Campo password muestra "enc:v1:aes-gcm:..."
- No se desencripta automáticamente

**Causas**:
- ENCRYPTION_SECRET no coincide
- Desencriptación falla

**Solución**:
1. Verifica `backend/.env` tiene ENCRYPTION_SECRET
2. Verifica que coincide con frontend
3. Borra configuración y guarda nuevamente

---

## Flujo Completo

```
┌─────────────────────────────────────────────────────────┐
│ Usuario abre csv-integration.html                       │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ DOMContentLoaded event dispara                          │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ initializeNetworkPathClient()                           │
│ ParserUI.init()                                         │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ ConfigLoader.loadAndRenderNetworkConfig()               │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ fetch('/api/config/load')                              │
└────────────────┬────────────────────────────────────────┘
                 ↓
         ┌───────┴────────┐
         ↓                ↓
    ✅ Config       ❌ No config
    found          found
         ↓                ↓
    Render          Return
    Connector       false
    tab             ↓
         ↓          Fields
    Load           empty
    Parser
         ↓
    Render
    Parser
    tab
         ↓
    Show
    Expected
    Columns
         ↓
    Ready to use
```

---

## Resumen

| Aspecto | Detalles |
|--------|----------|
| **Cuándo se carga** | Al abrir csv-integration.html |
| **Qué se carga** | Connector + Parser config |
| **Dónde se carga** | Desde `/api/config/load` |
| **Qué se renderiza** | Todos los campos y tablas |
| **Fallback** | Si no existe config, campos vacíos |
| **Persistencia** | Configuración se mantiene entre sesiones |

---

¿Necesitas ayuda con algo más?
