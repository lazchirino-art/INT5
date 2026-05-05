# INT5 - Arquitectura Técnica Detallada

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Estructura de Archivos](#estructura-de-archivos)
3. [Componentes Backend](#componentes-backend)
4. [Componentes Frontend](#componentes-frontend)
5. [Flujo de Dependencias](#flujo-de-dependencias)
6. [Diagrama de Arquitectura](#diagrama-de-arquitectura)
7. [Endpoints HTTP](#endpoints-http)
8. [Encriptación y Seguridad](#encriptación-y-seguridad)
9. [Flujos de Operación](#flujos-de-operación)
10. [Guía de Integración](#guía-de-integración)

---

## Descripción General

INT5 es una solución de integración CSV que permite:

1. **Conectar** a fuentes SMB/SFTP
2. **Detectar** archivos CSV automáticamente
3. **Parsear** CSV con validación avanzada
4. **Mapear** columnas a campos
5. **Validar** datos
6. **Persistir** configuración encriptada

### Stack Tecnológico

| Componente | Tecnología |
|-----------|-----------|
| **Backend** | Node.js + Express |
| **Frontend** | HTML5 + JavaScript Vanilla |
| **Encriptación** | WebCrypto (AES-GCM) |
| **Acceso SMB** | PowerShell + `net use` |
| **Persistencia** | JSON en filesystem |
| **Comunicación** | HTTP/JSON |

### Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                    │
│  HTML + JS Vanilla (sin frameworks)                      │
│                                                           │
│  csv-integration.html                                    │
│  ├─ Connector Tab (SMB/SFTP config)                     │
│  ├─ Parser Tab (CSV parsing)                           │
│  ├─ Mapping Tab (column mapping)                        │
│  ├─ Validation Tab (data validation)                    │
│  └─ Persistence Tab (save/load)                         │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP/JSON
                   │ (Fetch API)
                   ▼
┌─────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js/Express)                │
│                                                           │
│  server.js (Express app)                                │
│  ├─ POST /test-connection (SMB test)                    │
│  ├─ POST /api/connector/read-file (read CSV)            │
│  ├─ POST /api/config/save (persist config)              │
│  ├─ GET /api/config/load (load config)                  │
│  └─ DELETE /api/config/clear (clear config)             │
│                                                           │
│  Handlers:                                               │
│  ├─ NetworkPathHandlerWindows (PowerShell SMB)          │
│  └─ CredentialCrypto (decrypt credentials)              │
│                                                           │
│  Storage:                                                │
│  └─ config/app-config.json (encrypted config)           │
└──────────────────┬──────────────────────────────────────┘
                   │ PowerShell
                   │ (SMB access)
                   ▼
┌─────────────────────────────────────────────────────────┐
│              WINDOWS NETWORK (SMB)                       │
│                                                           │
│  \\server\share\folder\file.csv                         │
└─────────────────────────────────────────────────────────┘
```

---

## Estructura de Archivos

### Directorio Backend

```
backend/
├── credential-crypto.js              (120 líneas)
│   └─ Desencriptación AES-GCM de credenciales
│
├── network-path-handler-windows.js   (333 líneas)
│   └─ Acceso SMB via PowerShell + net use
│
├── network-path-handler.js           (232 líneas)
│   └─ [DEPRECATED] Acceso SMB via smb2 library
│
└── smb-file-detector-backend.js      (524 líneas)
    └─ [DEPRECATED] Detector SMB avanzado
```

### Directorio Frontend (src/js)

```
src/js/
├── credential-crypto.js              (148 líneas)
│   └─ Encriptación AES-GCM de credenciales
│
├── network-path-client.js            (133 líneas)
│   └─ Cliente HTTP para /test-connection
│
├── csv-integration.js                (573 líneas)
│   └─ Lógica principal del Connector tab
│
├── config-loader.js                  (298 líneas)
│   └─ Carga configuración guardada del backend
│
├── csv-parser.js                     (426 líneas)
│   └─ Validación y parsing de CSV
│
├── parser-ui.js                      (511 líneas)
│   └─ Interfaz del Parser tab
│
├── parser-ui-preview.js              (52 líneas)
│   └─ Renderizado de preview de CSV
│
├── app-init.js                       (207 líneas)
│   └─ Bootstrap de la aplicación
│
├── menu-handler.js                   (277 líneas)
│   └─ Manejo del menú principal
│
├── utils.js                          (318 líneas)
│   └─ Utilidades compartidas (storage, events, dom)
│
├── smb-client.js                     (221 líneas)
│   └─ [DEPRECATED] Cliente HTTP antiguo
│
└── smb-file-detector.js              (470 líneas)
    └─ [DEPRECATED] Detector SMB frontend
```

### Servidor Principal

```
server.js                             (404 líneas)
└─ Express app con todos los endpoints
```

---

## Componentes Backend

### 1. server.js (404 líneas)

**Responsabilidad**: Servidor Express principal

**Dependencias**:
- `express` - Framework HTTP
- `cors` - CORS middleware
- `dotenv` - Variables de entorno
- `fs` - Filesystem
- `NetworkPathHandlerWindows` - Handler SMB
- `CredentialCrypto` - Desencriptación

**Endpoints**:

| Método | Ruta | Propósito | Autenticación |
|--------|------|----------|---------------|
| POST | `/test-connection` | Probar conexión SMB | No |
| POST | `/api/connector/read-file` | Leer archivo CSV | No |
| POST | `/api/config/save` | Guardar configuración | No |
| GET | `/api/config/load` | Cargar configuración | No |
| DELETE | `/api/config/clear` | Limpiar configuración | No |
| GET | `/:page` | Servir páginas HTML | No |

**Flujo de Inicialización**:

```javascript
1. Cargar .env (ENCRYPTION_SECRET)
2. Crear app Express
3. Configurar middleware (CORS, JSON, static files)
4. Registrar endpoints
5. Cargar configuración guardada (si existe)
6. Iniciar servidor en puerto 3000
```

**Variables de Entorno**:

```bash
ENCRYPTION_SECRET=<secreto-de-encriptación>
PORT=3000  # opcional
```

---

### 2. backend/credential-crypto.js (120 líneas)

**Responsabilidad**: Desencriptación de credenciales en el backend

**Clase**: `CredentialCrypto`

**Constructor**:
```javascript
constructor(encryptionSecret)
```

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `decrypt(encryptedValue)` | string | Promise<string> | Desencripta un valor |
| `decryptConfig(config, sensitiveFields)` | object, array | Promise<object> | Desencripta campos sensibles |
| `getCryptoKey()` | - | Promise<CryptoKey> | Genera clave AES-GCM |

**Formato de Encriptación**:

```
enc:v1:aes-gcm:<iv_base64>:<encrypted_data_base64>
```

**Ejemplo de Uso**:

```javascript
const crypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
const decrypted = await crypto.decrypt('enc:v1:aes-gcm:...');
```

---

### 3. backend/network-path-handler-windows.js (333 líneas)

**Responsabilidad**: Acceso a rutas SMB via PowerShell

**Clase**: `NetworkPathHandlerWindows`

**Constructor**:
```javascript
constructor(credentialCrypto = null)
```

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `detect(options)` | {path, pattern, username, password, domain} | Promise<{status, file, logs}> | Detectar archivo en SMB |
| `readFile(options)` | {path, filename, username, password, domain} | Promise<string> | Leer contenido del archivo |
| `listFilesViaPS(path, credentials)` | string, object | Promise<string[]> | Listar archivos en carpeta |
| `selectFile(files, pattern)` | array, string | string \| null | Seleccionar archivo por patrón |
| `patternToRegex(pattern)` | string | RegExp | Convertir patrón a regex |

**Flujo de Detección**:

```
1. Validar ruta UNC (debe comenzar con \\)
2. Listar archivos via PowerShell
   - Si hay credenciales: net use + type
   - Si no: acceso directo
3. Aplicar patrón (wildcard a regex)
4. Seleccionar archivo (debe haber exactamente 1)
5. Retornar {status: 'READY'|'FAILED', file, logs}
```

**Comandos PowerShell Usados**:

```powershell
# Sin credenciales
cmd /c dir \\server\share\folder

# Con credenciales
cmd /c "net use \\server\share /delete /y >nul 2>&1 & net use \\server\share /user:domain\username password >nul 2>&1 & type \"\\server\share\file.csv\""
```

---

## Componentes Frontend

### 1. src/js/credential-crypto.js (148 líneas)

**Responsabilidad**: Encriptación de credenciales en el navegador

**Exposición Global**: `window.CredentialCrypto`

**Funciones Principales**:

| Función | Parámetros | Retorna | Propósito |
|---------|-----------|---------|----------|
| `encrypt(value)` | any | Promise<string> | Encripta un valor |
| `decrypt(value)` | string | Promise<any> | Desencripta un valor |
| `prepareConnectionConfigForStorage(config)` | object | Promise<object> | Encripta config para guardar |
| `prepareConnectionConfigForRuntime(config)` | object | Promise<object> | Desencripta config para usar |
| `isValidStoredConfig(config)` | object | boolean | Valida estructura de config |
| `getCryptoKey()` | - | Promise<CryptoKey> | Genera clave AES-GCM |

**Campos Sensibles por Tipo de Conexión**:

```javascript
{
  networkPath: ['password'],
  sftp: ['password', 'privateKey', 'passphrase']
}
```

**Clave de Encriptación**:

```javascript
// Derivada de window.CSV_INT_LOCAL_SECRET
// Usando SHA-256 + AES-GCM
```

**Ejemplo de Uso**:

```javascript
// Guardar
const config = { connectorType: 'networkPath', password: 'secret123' };
const stored = await CredentialCrypto.prepareConnectionConfigForStorage(config);
// stored.password = 'enc:v1:aes-gcm:...'

// Cargar
const runtime = await CredentialCrypto.prepareConnectionConfigForRuntime(stored);
// runtime.password = 'secret123'
```

---

### 2. src/js/network-path-client.js (133 líneas)

**Responsabilidad**: Cliente HTTP para comunicarse con backend

**Clase**: `NetworkPathClient`

**Constructor**:
```javascript
constructor(baseURL = 'http://localhost:3000')
```

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `testConnection(credentials)` | {path, pattern, username, password, domain} | Promise<{status, file, logs, clientLogs, serverLogs}> | Probar conexión SMB |
| `getClientLogs()` | - | array | Obtener logs del cliente |
| `clearLogs()` | - | void | Limpiar logs |

**Flujo de testConnection**:

```
1. Validar que path y pattern existan
2. Preparar payload JSON
3. POST /test-connection
4. Si error 400: extraer logs del servidor
5. Combinar logs del cliente y servidor
6. Retornar {status, file, logs, clientLogs, serverLogs}
```

**Ejemplo de Uso**:

```javascript
const client = new NetworkPathClient('http://localhost:3000');
const result = await client.testConnection({
  path: '\\\\server\\share\\folder',
  pattern: '*.csv',
  username: 'user',
  password: 'pass',
  domain: 'DOMAIN'
});

console.log(result.status);  // 'READY' o 'FAILED'
console.log(result.file);    // 'file.csv' o null
console.log(result.logs);    // array de strings
```

---

### 3. src/js/csv-integration.js (573 líneas)

**Responsabilidad**: Lógica principal del Connector tab

**Funciones Principales**:

| Función | Parámetros | Retorna | Propósito |
|---------|-----------|---------|----------|
| `getNetworkConnectionConfig()` | - | object | Obtener config del formulario |
| `validateNetworkConnectionConfig(config)` | object | {valid, errors} | Validar config |
| `testNetworkConnection()` | - | Promise<void> | Probar conexión |
| `saveCurrentConnectionConfig()` | - | Promise<void> | Guardar configuración |
| `loadStoredConnectionConfigForRuntime()` | - | Promise<object> | Cargar config guardada |
| `handleConnectionTypeChange()` | - | void | Cambiar tipo de conexión |
| `toggleAuthenticationFields()` | - | void | Habilitar/deshabilitar auth |

**Estado Global**:

```javascript
let networkPathClient = null;  // Cliente HTTP singleton
```

**Flujo de Test Connection**:

```
1. Obtener config del formulario
2. Validar campos requeridos
3. Crear NetworkPathClient
4. Encriptar credenciales (si existen)
5. POST /test-connection
6. Renderizar logs en UI
7. Habilitar "Save Configuration" si status = READY
```

**Flujo de Save Configuration**:

```
1. Obtener config del formulario
2. Encriptar campos sensibles
3. POST /api/config/save
4. Mostrar estado "SAVE: SAVED"
5. Configuración persiste en backend
```

---

### 4. src/js/config-loader.js (298 líneas)

**Responsabilidad**: Cargar configuración guardada del backend

**Clase**: `ConfigLoader` (métodos estáticos)

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `loadAndRenderNetworkConfig()` | - | Promise<boolean> | Cargar y renderizar config |
| `loadPersistedConfiguration()` | - | Promise<object> | Cargar del backend |
| `clearSavedConfiguration()` | - | Promise<void> | Limpiar config guardada |
| `hasSavedConfiguration()` | - | Promise<boolean> | Verificar si existe config |

**Flujo de Carga**:

```
1. GET /api/config/load
2. Si existe:
   a. Validar estructura
   b. Desencriptar campos sensibles
   c. Rellenar formulario
   d. Ejecutar toggles de UI
3. Si no existe:
   a. Retornar false
   b. Mostrar formulario vacío
```

**Inicialización Automática**:

```javascript
// En DOMContentLoaded
await ConfigLoader.loadAndRenderNetworkConfig();
document.getElementById('connectionType').value = 'networkPath';
```

---

### 5. src/js/csv-parser.js (426 líneas)

**Responsabilidad**: Validación y parsing de CSV

**Clase**: `CSVParser` (métodos estáticos)

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `validateConfiguration(connectorConfig, parserConfig)` | object, object | Promise<{status, logs, errors, warnings}> | Validar CSV contra config |
| `readFile(connectorConfig)` | object | Promise<string> | Leer archivo del backend |
| `detectEncoding(content)` | string | string | Detectar encoding |
| `detectDelimiter(lines)` | array | {delimiter, columnCount} | Detectar delimitador |
| `parseCSVLine(line, delimiter, quoteChar, escapeChar)` | string, string, string, string | array | Parsear línea CSV |

**Flujo de Validación**:

```
1. Leer archivo via /api/connector/read-file
2. Detectar encoding
3. Detectar delimitador
4. Parsear header
5. Validar consistencia de filas
6. Validar caracteres especiales
7. Validar columnas requeridas
8. Retornar {status, logs, errors, warnings}
```

**Ejemplo de Uso**:

```javascript
const result = await CSVParser.validateConfiguration(
  {
    connectorType: 'networkPath',
    path: '\\\\server\\share',
    fileNamePattern: '*.csv',
    useAuthentication: true,
    username: 'user',
    password: 'enc:v1:aes-gcm:...'
  },
  {
    delimiter: ',',
    hasHeader: 'Yes',
    quoteChar: '"',
    escapeChar: '"',
    columns: [
      { name: 'MedicationName', index: 0 }
    ]
  }
);
```

---

### 6. src/js/parser-ui.js (511 líneas)

**Responsabilidad**: Interfaz del Parser tab

**Clase**: `ParserUI` (métodos estáticos)

**Estado**:

```javascript
static parserState = {
  status: 'NOT_TESTED',
  errors: [],
  warnings: [],
  columnNames: [],
  columnCount: 0,
  preview: []
}
```

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `init()` | - | void | Inicializar event listeners |
| `checkParserConfiguration()` | - | Promise<void> | Validar configuración |
| `saveParserConfiguration()` | - | Promise<void> | Guardar configuración |
| `getParserConfig()` | - | object | Obtener config del formulario |
| `getUserColumns()` | - | array | Obtener columnas configuradas |
| `getConnectorConfig()` | - | Promise<object> | Obtener config del Connector |

**Flujo de Check Configuration**:

```
1. Obtener config del Parser
2. Obtener columnas del usuario
3. Obtener config del Connector
4. Validar que Connector esté guardado
5. Llamar CSVParser.validateConfiguration()
6. Actualizar UI con resultados
7. Mostrar preview si éxito
```

---

### 7. src/js/app-init.js (207 líneas)

**Responsabilidad**: Bootstrap de la aplicación

**Clase**: `AppInitializer` (singleton)

**Métodos Principales**:

| Método | Parámetros | Retorna | Propósito |
|--------|-----------|---------|----------|
| `init()` | - | void | Inicializar aplicación |
| `loadConfig()` | - | object | Cargar configuración global |
| `isInitialized()` | - | boolean | Verificar si está inicializado |
| `getConfig()` | - | object | Obtener configuración |

**Flujo de Inicialización**:

```
1. Cargar AppConfig global
2. Verificar localStorage disponible
3. Inicializar storage (user_preferences, session_data)
4. Registrar event listeners (visibility, beforeunload, error)
5. Emitir evento 'app:initialized'
6. Marcar como inicializado
```

**Evento Emitido**:

```javascript
Utils.events.emit('app:initialized', { timestamp: Date.now() })
```

---

### 8. src/js/utils.js (318 líneas)

**Responsabilidad**: Utilidades compartidas

**Exposición Global**: `window.Utils`

**Submódulos**:

| Submódulo | Métodos | Propósito |
|-----------|---------|----------|
| `storage` | set, get, remove, clear | localStorage con JSON |
| `logger` | info, warn, error, debug | Console logging con timestamp |
| `dom` | createElement, addClass, removeClass, on | DOM helpers |
| `validation` | isEmail, isEmpty, isNumber, isURL | Validación de inputs |
| `time` | now, format, diff | Utilidades de tiempo |
| `events` | on, emit, off | Event bus simple |

**Ejemplo de Uso**:

```javascript
// Storage
Utils.storage.set('key', {data: 'value'});
const data = Utils.storage.get('key');

// Events
Utils.events.on('app:initialized', (data) => {
  console.log('App initialized');
});

Utils.events.emit('custom:event', {payload: 'data'});

// DOM
const el = Utils.dom.createElement('div', {
  class: 'my-class',
  id: 'my-id'
});
```

---

## Flujo de Dependencias

### Dependencias del Backend

```
server.js
├── express
├── cors
├── dotenv
├── fs (Node.js)
├── NetworkPathHandlerWindows
│   ├── child_process.exec
│   └── util.promisify
└── CredentialCrypto
    ├── crypto
    └── webcrypto
```

### Dependencias del Frontend

```
csv-integration.html
├── config/app-config.js
├── src/js/utils.js
├── src/js/credential-crypto.js
├── src/js/app-local-secret.js (define window.CSV_INT_LOCAL_SECRET)
├── src/js/app-init.js
│   └── Utils
├── src/js/menu-handler.js
│   └── Utils
├── src/js/csv-integration.js
│   ├── NetworkPathClient
│   ├── CredentialCrypto
│   └── Utils
├── src/js/config-loader.js
│   ├── CredentialCrypto
│   └── csv-integration.js (funciones globales)
├── src/js/csv-parser.js
│   └── (sin dependencias internas)
├── src/js/parser-ui.js
│   ├── CSVParser
│   ├── config-loader.js
│   ├── CredentialCrypto
│   └── parser-ui-preview.js
└── src/js/parser-ui-preview.js
    └── (sin dependencias)
```

---

## Diagrama de Arquitectura

### Flujo de Test Connection

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                              │
│                                                                  │
│ 1. User clicks "Test Connection"                               │
│    ↓                                                             │
│ 2. csv-integration.js::testNetworkConnection()                 │
│    ├─ Obtener config del formulario                            │
│    ├─ Validar campos                                           │
│    ├─ Crear NetworkPathClient                                  │
│    └─ Encriptar credenciales (CredentialCrypto)               │
│        ↓                                                         │
│ 3. NetworkPathClient.testConnection()                          │
│    └─ POST /test-connection (JSON payload)                     │
│        ↓                                                         │
└────────┼──────────────────────────────────────────────────────┘
         │ HTTP POST
         │ {path, pattern, username, password, domain}
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js)                                               │
│                                                                  │
│ 4. server.js::POST /test-connection                            │
│    ├─ Validar entrada                                          │
│    ├─ Crear CredentialCrypto                                   │
│    └─ Crear NetworkPathHandlerWindows                          │
│        ↓                                                         │
│ 5. NetworkPathHandlerWindows.detect()                          │
│    ├─ Validar ruta UNC                                         │
│    ├─ Listar archivos via PowerShell                           │
│    ├─ Aplicar patrón (wildcard → regex)                        │
│    ├─ Seleccionar archivo                                      │
│    └─ Retornar {status, file, logs}                            │
│        ↓                                                         │
│ 6. PowerShell execution                                         │
│    ├─ net use (mount share)                                    │
│    ├─ dir (list files)                                         │
│    └─ type (read file)                                         │
│        ↓                                                         │
└────────┼──────────────────────────────────────────────────────┘
         │ HTTP 200 JSON
         │ {status, file, logs}
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                              │
│                                                                  │
│ 7. NetworkPathClient.testConnection() returns                  │
│    ├─ Combinar logs (client + server)                          │
│    └─ Retornar {status, file, logs, clientLogs, serverLogs}   │
│        ↓                                                         │
│ 8. csv-integration.js::renderConnectionLog()                   │
│    ├─ Mostrar logs en UI                                       │
│    ├─ Actualizar Connection Status                             │
│    └─ Habilitar "Save Configuration" si status = READY         │
│        ↓                                                         │
│ 9. User clicks "Save Configuration"                            │
│    ├─ Encriptar credenciales                                   │
│    └─ POST /api/config/save                                    │
│        ↓                                                         │
└────────┼──────────────────────────────────────────────────────┘
         │ HTTP POST
         │ {connection: {connectorType, path, ...}}
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js)                                               │
│                                                                  │
│ 10. server.js::POST /api/config/save                           │
│     ├─ Validar payload                                         │
│     ├─ Escribir config/app-config.json                         │
│     └─ Retornar {status: 'SUCCESS'}                            │
│         ↓                                                        │
└────────┼──────────────────────────────────────────────────────┘
         │ HTTP 200 JSON
         │ {status: 'SUCCESS'}
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                              │
│                                                                  │
│ 11. Mostrar "SAVE: SAVED"                                      │
│     └─ Configuración guardada en backend                       │
│         ↓                                                        │
│ 12. Próxima sesión:                                            │
│     ├─ DOMContentLoaded                                        │
│     ├─ ConfigLoader.loadAndRenderNetworkConfig()               │
│     ├─ GET /api/config/load                                    │
│     ├─ Desencriptar credenciales                               │
│     └─ Rellenar formulario automáticamente                     │
│         ↓                                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Parser Validation

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                              │
│                                                                  │
│ 1. User clicks "Check Configuration" in Parser tab             │
│    ↓                                                             │
│ 2. parser-ui.js::ParserUI.checkParserConfiguration()           │
│    ├─ Obtener parserConfig                                     │
│    ├─ Obtener userColumns                                      │
│    ├─ Obtener connectorConfig (via config-loader)              │
│    └─ Validar que Connector esté guardado                      │
│        ↓                                                         │
│ 3. csv-parser.js::CSVParser.validateConfiguration()            │
│    ├─ Llamar readFile()                                        │
│    ├─ Detectar encoding                                        │
│    ├─ Detectar delimitador                                     │
│    ├─ Parsear header                                           │
│    ├─ Validar consistencia de filas                            │
│    ├─ Validar caracteres especiales                            │
│    ├─ Validar columnas requeridas                              │
│    └─ Retornar {status, logs, errors, warnings}                │
│        ↓                                                         │
│ 4. CSVParser.readFile()                                        │
│    └─ POST /api/connector/read-file                            │
│        ↓                                                         │
└────────┼──────────────────────────────────────────────────────┘
         │ HTTP POST
         │ {connectorType, path, fileNamePattern, ...}
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js)                                               │
│                                                                  │
│ 5. server.js::POST /api/connector/read-file                    │
│    ├─ Validar entrada                                          │
│    ├─ Crear CredentialCrypto                                   │
│    ├─ Crear NetworkPathHandlerWindows                          │
│    ├─ Detectar archivo                                         │
│    ├─ Desencriptar contraseña                                  │
│    ├─ Leer contenido del archivo                               │
│    └─ Retornar {content, filename, size, encoding}             │
│        ↓                                                         │
└────────┼──────────────────────────────────────────────────────┘
         │ HTTP 200 JSON
         │ {content: "...", filename: "...", size: ..., encoding: "UTF-8"}
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                              │
│                                                                  │
│ 6. CSVParser.validateConfiguration() completa                  │
│    ├─ Actualizar parserState                                   │
│    ├─ Renderizar logs en UI                                    │
│    ├─ Mostrar preview (si éxito)                               │
│    └─ Habilitar "Save Parser Configuration"                    │
│        ↓                                                         │
│ 7. Mostrar resultados:                                         │
│    ├─ STATUS: VALID o FAILED                                   │
│    ├─ Logs detallados                                          │
│    ├─ Preview de primeras filas                                │
│    └─ Errores/warnings                                         │
│        ↓                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Endpoints HTTP

### POST /test-connection

**Propósito**: Probar conexión a SMB y detectar archivo

**Request**:
```json
{
  "path": "\\\\server\\share\\folder",
  "pattern": "*.csv",
  "username": "user",
  "password": "pass",
  "domain": "DOMAIN"
}
```

**Response (Success)**:
```json
{
  "status": "READY",
  "file": "file.csv",
  "logs": [
    "✓ Resolving path...",
    "✓ Connecting to network share...",
    "✓ File selected: file.csv"
  ]
}
```

**Response (Failure)**:
```json
{
  "status": "FAILED",
  "file": null,
  "logs": [
    "✗ Error: Server not reachable"
  ]
}
```

---

### POST /api/connector/read-file

**Propósito**: Leer archivo CSV del backend

**Request**:
```json
{
  "connectorType": "networkPath",
  "path": "\\\\server\\share\\folder",
  "fileNamePattern": "*.csv",
  "username": "user",
  "password": "enc:v1:aes-gcm:...",
  "domain": "DOMAIN",
  "useAuthentication": true
}
```

**Response (Success)**:
```json
{
  "content": "Name,Age,City\nJohn,30,NYC\n...",
  "filename": "file.csv",
  "size": 1024,
  "encoding": "UTF-8"
}
```

**Response (Failure)**:
```json
{
  "error": {
    "message": "File not found"
  },
  "logs": [...]
}
```

---

### POST /api/config/save

**Propósito**: Guardar configuración en backend

**Request**:
```json
{
  "connection": {
    "connectorType": "networkPath",
    "type": "Network Path",
    "path": "\\\\server\\share\\folder",
    "fileNamePattern": "*.csv",
    "useAuthentication": true,
    "username": "user",
    "password": "enc:v1:aes-gcm:...",
    "useDomain": false,
    "domain": ""
  }
}
```

**Response**:
```json
{
  "status": "SUCCESS",
  "message": "Configuration saved",
  "path": "/path/to/config/app-config.json"
}
```

---

### GET /api/config/load

**Propósito**: Cargar configuración guardada

**Request**: (sin body)

**Response (Found)**:
```json
{
  "status": "SUCCESS",
  "config": {
    "connection": {
      "connectorType": "networkPath",
      "path": "\\\\server\\share\\folder",
      ...
    }
  }
}
```

**Response (Not Found)**:
```json
{
  "status": "NOT_FOUND",
  "config": null,
  "message": "No saved configuration"
}
```

---

### DELETE /api/config/clear

**Propósito**: Limpiar configuración guardada

**Request**: (sin body)

**Response**:
```json
{
  "status": "SUCCESS",
  "message": "Configuration cleared"
}
```

---

## Encriptación y Seguridad

### Algoritmo de Encriptación

**Algoritmo**: AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)

**Tamaño de Clave**: 256 bits (derivada de ENCRYPTION_SECRET)

**Tamaño de IV**: 12 bytes (aleatorio para cada encriptación)

**Derivación de Clave**:

```
1. Tomar ENCRYPTION_SECRET (string)
2. Codificar a UTF-8
3. Aplicar SHA-256
4. Usar resultado como clave AES-256
```

### Formato de Encriptación

```
enc:v1:aes-gcm:<iv_base64>:<encrypted_data_base64>

Ejemplo:
enc:v1:aes-gcm:aBcDeFgHiJkLmN==:xYzAbCdEfGhIjKlMnOpQrStUvWxYz==
```

### Flujo de Encriptación Frontend → Backend

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                          │
│                                                              │
│ 1. User ingresa contraseña en texto plano                  │
│    password = "mypassword123"                               │
│    ↓                                                         │
│ 2. csv-integration.js::saveCurrentConnectionConfig()       │
│    ├─ Obtener config del formulario                        │
│    └─ Llamar CredentialCrypto.prepareConnectionConfigForStorage()
│        ↓                                                     │
│ 3. CredentialCrypto.encrypt(password)                      │
│    ├─ Obtener clave de window.CSV_INT_LOCAL_SECRET         │
│    ├─ Generar IV aleatorio (12 bytes)                      │
│    ├─ Encriptar con AES-GCM                                │
│    └─ Retornar "enc:v1:aes-gcm:..."                        │
│        ↓                                                     │
│ 4. POST /api/config/save                                   │
│    └─ JSON con password encriptado                         │
│        ↓                                                     │
└────────┼──────────────────────────────────────────────────┘
         │ HTTP POST (encrypted)
         │ {password: "enc:v1:aes-gcm:..."}
         ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js)                                           │
│                                                              │
│ 5. server.js::POST /api/config/save                        │
│    ├─ Recibir JSON con password encriptado                 │
│    ├─ Guardar en config/app-config.json                    │
│    └─ Password nunca se desencripta en este endpoint        │
│        ↓                                                     │
│ 6. Cuando se necesita usar la contraseña:                  │
│    ├─ Crear CredentialCrypto(process.env.ENCRYPTION_SECRET)
│    ├─ Llamar decrypt(encryptedPassword)                    │
│    ├─ Obtener clave de ENCRYPTION_SECRET                   │
│    ├─ Desencriptar con AES-GCM                             │
│    └─ Retornar "mypassword123"                             │
│        ↓                                                     │
│ 7. Usar contraseña desencriptada en PowerShell             │
│    └─ net use ... /user:... mypassword123                  │
│        ↓                                                     │
└────────┼──────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ WINDOWS NETWORK (SMB)                                       │
│                                                              │
│ 8. Acceso a \\server\share\folder                          │
│    ├─ Autenticación con credenciales                       │
│    └─ Acceso a archivos                                    │
│        ↓                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Requisito de Sincronización de Secretos

Para que funcione correctamente, **ENCRYPTION_SECRET debe ser idéntico** en:

1. **Backend** (`backend/.env`):
   ```
   ENCRYPTION_SECRET=<secreto-de-encriptación>
   ```

2. **Frontend** (`src/pages/csv-integration.html`):
   ```javascript
   Object.defineProperty(window, 'CSV_INT_LOCAL_SECRET', {
     value: '<secreto-de-encriptación>',
     writable: false,
     configurable: false
   });
   ```

3. **Frontend** (`src/pages/index.html`):
   ```javascript
   Object.defineProperty(window, 'CSV_INT_LOCAL_SECRET', {
     value: '<secreto-de-encriptación>',
     writable: false,
     configurable: false
   });
   ```

---

## Flujos de Operación

### Flujo 1: Primera Vez - Test Connection

```
1. Usuario abre csv-integration.html
2. ConfigLoader intenta cargar config guardada
   → No existe, formulario vacío
3. Usuario selecciona "Network Path"
4. Usuario ingresa:
   - Path: \\server\share\folder
   - Pattern: *.csv
   - Username: user
   - Password: pass
5. Usuario hace clic en "Test Connection"
6. Frontend encripta password
7. Frontend POST /test-connection
8. Backend:
   a. Desencripta password
   b. Ejecuta PowerShell: net use + dir
   c. Detecta archivo
   d. Retorna {status: 'READY', file: 'data.csv', logs: [...]}
9. Frontend renderiza logs
10. Frontend habilita "Save Configuration"
11. Usuario hace clic en "Save Configuration"
12. Frontend encripta password
13. Frontend POST /api/config/save
14. Backend guarda en config/app-config.json
15. Frontend muestra "SAVE: SAVED"
```

### Flujo 2: Próxima Sesión - Auto-Load

```
1. Usuario abre csv-integration.html
2. DOMContentLoaded dispara
3. ConfigLoader.loadAndRenderNetworkConfig()
4. Frontend GET /api/config/load
5. Backend retorna config guardada (con password encriptado)
6. Frontend desencripta password
7. Frontend rellena formulario automáticamente
8. Campos están habilitados/deshabilitados según config
9. Usuario puede:
   a. Hacer Test Connection nuevamente
   b. Pasar a Parser tab
   c. Modificar config y guardar nueva
```

### Flujo 3: Parser Validation

```
1. Usuario va a Parser tab
2. Usuario configura:
   - Delimiter: ,
   - Has Header: Yes
   - Quote Char: "
   - Columns: [MedicationName, Dosage, ...]
3. Usuario hace clic en "Check Configuration"
4. Frontend obtiene connectorConfig (guardada)
5. Frontend POST /api/connector/read-file
6. Backend:
   a. Detecta archivo
   b. Desencripta password
   c. Lee archivo via PowerShell
   d. Retorna contenido
7. Frontend CSVParser.validateConfiguration():
   a. Detecta encoding
   b. Detecta delimitador
   c. Parsea header
   d. Valida filas
   e. Valida columnas requeridas
8. Frontend renderiza:
   - Logs detallados
   - Preview de primeras filas
   - Errores/warnings
9. Si status = VALID:
   - Habilitar "Save Parser Configuration"
```

---

## Guía de Integración

### Para Integrar en Solución Completa

#### 1. Dependencias de Backend

```bash
npm install express cors dotenv
```

#### 2. Dependencias de Frontend

No hay dependencias externas. Solo JavaScript vanilla + WebCrypto (nativo del navegador).

#### 3. Variables de Entorno

```bash
# backend/.env
ENCRYPTION_SECRET=<generar-con-openssl-rand-hex-32>
PORT=3000
```

#### 4. Configuración de Secretos

Generar secreto único:

```bash
openssl rand -hex 32
# Salida: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Actualizar en:
- `backend/.env`: `ENCRYPTION_SECRET=...`
- `src/pages/csv-integration.html`: `window.CSV_INT_LOCAL_SECRET = "..."`
- `src/pages/index.html`: `window.CSV_INT_LOCAL_SECRET = "..."`

#### 5. Iniciar Backend

```bash
node server.js
```

Debería ver:

```
🔥 ESTE ES MI SERVER REAL 🔥

==================================================
Backend Server
==================================================

✔ Server running on port 3000
✔ URL: http://localhost:3000
✔ Endpoint: POST /test-connection
✔ Config API: POST /api/config/save
✔ Config API: GET /api/config/load
✔ Config API: DELETE /api/config/clear
✔ Config file: /path/to/config/app-config.json

==================================================
```

#### 6. Acceder a Frontend

```
http://localhost:3000/src/pages/csv-integration.html
```

#### 7. Integración con Solución Existente

Si tienes una solución existente:

1. **Copiar archivos backend**:
   ```
   backend/
   ├── credential-crypto.js
   ├── network-path-handler-windows.js
   └── (otros handlers si necesitas)
   ```

2. **Copiar archivos frontend**:
   ```
   src/js/
   ├── credential-crypto.js
   ├── network-path-client.js
   ├── csv-integration.js
   ├── config-loader.js
   ├── csv-parser.js
   ├── parser-ui.js
   └── parser-ui-preview.js
   ```

3. **Copiar páginas HTML**:
   ```
   src/pages/
   ├── csv-integration.html
   └── (actualizar scripts imports)
   ```

4. **Integrar endpoints en tu Express app**:
   ```javascript
   import CredentialCrypto from './backend/credential-crypto.js';
   import NetworkPathHandlerWindows from './backend/network-path-handler-windows.js';
   
   // Agregar endpoints (ver server.js para ejemplos)
   app.post('/test-connection', async (req, res) => { ... });
   app.post('/api/connector/read-file', async (req, res) => { ... });
   app.post('/api/config/save', (req, res) => { ... });
   app.get('/api/config/load', (req, res) => { ... });
   app.delete('/api/config/clear', (req, res) => { ... });
   ```

5. **Configurar variables de entorno**:
   ```bash
   ENCRYPTION_SECRET=<tu-secreto>
   ```

6. **Actualizar imports en HTML**:
   ```html
   <script src="/src/js/credential-crypto.js"></script>
   <script src="/src/js/network-path-client.js"></script>
   <script src="/src/js/csv-parser.js"></script>
   <script src="/src/js/parser-ui.js"></script>
   <script src="/src/js/config-loader.js"></script>
   <script src="/src/js/csv-integration.js"></script>
   ```

---

## Resumen de Archivos

| Archivo | Líneas | Propósito | Tipo |
|---------|--------|----------|------|
| server.js | 404 | Express app principal | Backend |
| backend/credential-crypto.js | 120 | Desencriptación AES-GCM | Backend |
| backend/network-path-handler-windows.js | 333 | Acceso SMB via PowerShell | Backend |
| src/js/credential-crypto.js | 148 | Encriptación AES-GCM | Frontend |
| src/js/network-path-client.js | 133 | Cliente HTTP | Frontend |
| src/js/csv-integration.js | 573 | Lógica Connector tab | Frontend |
| src/js/config-loader.js | 298 | Carga config guardada | Frontend |
| src/js/csv-parser.js | 426 | Validación CSV | Frontend |
| src/js/parser-ui.js | 511 | UI Parser tab | Frontend |
| src/js/parser-ui-preview.js | 52 | Preview CSV | Frontend |
| src/js/app-init.js | 207 | Bootstrap app | Frontend |
| src/js/utils.js | 318 | Utilidades compartidas | Frontend |
| **TOTAL** | **4,522** | | |

---

## Notas Importantes

1. **No hay frameworks**: Todo es JavaScript vanilla. Facilita integración en cualquier proyecto.

2. **Encriptación obligatoria**: Las credenciales siempre se encriptan. No hay fallback a texto plano.

3. **Configuración persistente**: Se guarda en `config/app-config.json` en el backend.

4. **Logs detallados**: Cada operación genera logs que se muestran en la UI.

5. **Validación en dos niveles**: Frontend (UX) + Backend (seguridad).

6. **PowerShell para SMB**: Usa `net use` para montar shares. Requiere Windows.

7. **Sincronización de secretos**: ENCRYPTION_SECRET debe ser idéntico en frontend y backend.

8. **Sin dependencias externas en frontend**: Solo WebCrypto (nativo).

9. **Modular**: Cada componente puede usarse independientemente.

10. **Extensible**: Fácil agregar nuevos tipos de conexión (SFTP, Google Drive, etc.).

---

## Contacto y Soporte

Para preguntas técnicas o integración:
- Ver `docs/CONNECTOR-TAB.md` para guía de usuario
- Ver `docs/API-ENDPOINT.md` para detalles de endpoints
- Ver `docs/FLUJO-COMPLETO.md` para flujo general
