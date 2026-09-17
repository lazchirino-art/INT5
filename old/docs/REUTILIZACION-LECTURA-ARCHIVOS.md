# INT5 - Reutilización de Funciones de Lectura y Búsqueda en Entorno Real

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Novedades recientes: `rowToObject` confirma que producción lee por Column Index; el log de importación guarda los valores de las columnas y el operador.

## 📋 Tabla de Contenidos

1. [Arquitectura de Dos Fases](#arquitectura-de-dos-fases)
2. [Flujo de Credenciales Encriptadas](#flujo-de-credenciales-encriptadas)
3. [Fase 1: Configuración (Testing)](#fase-1-configuración-testing)
4. [Fase 2: Producción (Búsqueda)](#fase-2-producción-búsqueda)
5. [Funciones Reutilizables](#funciones-reutilizables)
6. [Formato de Datos](#formato-de-datos)
7. [Ejemplos Prácticos](#ejemplos-prácticos)
8. [Endpoints para Producción](#endpoints-para-producción)
9. [Guía de Integración](#guía-de-integración)
10. [Seguridad](#seguridad)

---

## Flujo de Credenciales Encriptadas

### ¿Cómo se manejan las credenciales?

**Principio fundamental**: Las credenciales nunca se guardan en texto plano.

#### Ciclo de vida de una contraseña

```
┌─────────────────────────────────────────────────────────┐
│ CICLO DE VIDA DE CREDENCIALES                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. ENTRADA (Usuario)                                   │
│    └─ Texto plano: "client123"                         │
│                                                         │
│ 2. ENCRIPTACIÓN (Frontend)                             │
│    └─ AES-GCM con ENCRYPTION_SECRET                    │
│    └─ Resultado: "enc:v1:aes-gcm:..."                  │
│                                                         │
│ 3. TRANSMISIÓN (HTTPS)                                 │
│    └─ Encriptada en tránsito                           │
│    └─ Backend recibe: "enc:v1:aes-gcm:..."             │
│                                                         │
│ 4. ALMACENAMIENTO (config.json)                        │
│    └─ Guardada encriptada                              │
│    └─ Nunca en texto plano                             │
│                                                         │
│ 5. DESENCRIPTACIÓN (Backend en memoria)                │
│    └─ Solo cuando se necesita acceder a SMB            │
│    └─ Usa ENCRYPTION_SECRET de .env                    │
│    └─ Resultado: "client123"                           │
│                                                         │
│ 6. USO (Comando PowerShell)                            │
│    └─ Acceso a SMB                                     │
│    └─ Credenciales en memoria                          │
│                                                         │
│ 7. DESCARTE                                            │
│    └─ Se elimina de memoria                            │
│    └─ No se loguea                                     │
│    └─ No se expone                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Requisitos de Seguridad

1. **ENCRYPTION_SECRET**
   - Debe ser el MISMO en frontend y backend
   - Debe ser diferente en cada entorno (dev, staging, prod)
   - Debe tener mínimo 32 caracteres
   - Nunca debe estar en el código
   - Debe estar en `backend/.env` (NO en .gitignore)

2. **Almacenamiento**
   - `config/app-config.json` - Guardado encriptado (OK en repo)
   - `backend/.env` - Contiene ENCRYPTION_SECRET (EN .gitignore)
   - Nunca guardar credenciales en texto plano

3. **Transmisión**
   - Siempre usar HTTPS en producción
   - Credenciales encriptadas en el body
   - No en headers
   - No en URLs

---

## Arquitectura de Dos Fases

### Fase 1: CONFIGURACIÓN (Entorno Testing)

```
┌─────────────────────────────────────────────────────────┐
│ FASE 1: CONFIGURACIÓN Y TESTING                         │
│                                                          │
│ Objetivo: Validar conexión y formato de archivo         │
│                                                          │
│ 1. Test Connection                                      │
│    └─ Verifica que archivo existe                       │
│                                                          │
│ 2. Check Configuration                                  │
│    ├─ Lee primeras 10 filas                            │
│    ├─ Detecta delimitador                              │
│    ├─ Valida columnas                                  │
│    └─ Muestra preview                                  │
│                                                          │
│ 3. Save Configuration                                   │
│    ├─ Guarda path SMB                                  │
│    ├─ Guarda delimitador detectado                     │
│    ├─ Guarda nombres de columnas                       │
│    ├─ Guarda índices de columnas                       │
│    ├─ Guarda credenciales ENCRIPTADAS (AES-GCM)        │
│    └─ Guarda username (texto plano, no sensible)       │
│                                                          │
│ Resultado: config/app-config.json                       │
│ {                                                        │
│   "connection": {...},                                  │
│   "parser": {                                           │
│     "delimiter": ",",                                   │
│     "hasHeader": true,                                  │
│     "columnNames": ["MedicationName", "Dosage", ...],   │
│     "columns": [                                        │
│       {name: "MedicationName", index: 0},               │
│       {name: "Code", index: 1},                         │
│       {name: "Dosage", index: 2},                       │
│       ...                                               │
│     ]                                                   │
│   }                                                     │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
```

### Fase 2: PRODUCCIÓN (Búsqueda)

```
┌─────────────────────────────────────────────────────────┐
│ FASE 2: PRODUCCIÓN Y BÚSQUEDA                           │
│                                                          │
│ Objetivo: Buscar producto por identificador             │
│                                                          │
│ 1. Cargar Configuración Guardada                        │
│    └─ Lee config/app-config.json                       │
│                                                          │
│ 2. Leer Archivo Completo                                │
│    ├─ Lee TODAS las filas (no solo 10)                 │
│    └─ Parsea con delimitador guardado                  │
│                                                          │
│ 3. Buscar Producto                                      │
│    ├─ Busca en columna de código (índice 1)            │
│    ├─ Compara con identificador buscado                │
│    └─ Retorna fila completa si encuentra               │
│                                                          │
│ 4. Retornar Datos Estructurados                         │
│    └─ JSON con todos los campos de la fila             │
│                                                          │
│ Resultado: Datos del producto                           │
│ {                                                        │
│   "found": true,                                        │
│   "product": {                                          │
│     "MedicationName": "Aspirin",                        │
│     "Code": "ASP001",                                   │
│     "Dosage": "500mg",                                  │
│     "Route": "Oral",                                    │
│     ...                                                 │
│   },                                                    │
│   "rowIndex": 42                                        │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Fase 1: Configuración (Testing)

### Flujo Actual (Ya Implementado)

```javascript
// 1. Test Connection
POST /test-connection
{
  "path": "\\\\server\\share\\folder",
  "pattern": "*.csv",
  "username": "user",
  "password": "pass"
}

// 2. Check Configuration
POST /api/connector/read-file
{
  "connectorType": "networkPath",
  "path": "\\\\server\\share\\folder",
  "fileNamePattern": "*.csv",
  "username": "user",
  "password": "enc:v1:aes-gcm:..."
}

// Response: Contenido del archivo (primeras 10 filas en preview)
{
  "content": "MedicationName,Dosage,Route\n...",
  "filename": "w.csv",
  "size": 1024,
  "encoding": "UTF-8"
}

// 3. Frontend parsea y genera preview
// 4. User guarda configuración
POST /api/config/save
{
  "connection": {...},
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "columns": [...]
  }
}

// 5. Configuración guardada en: config/app-config.json
```

---

## Fase 2: Producción (Búsqueda)

### Nuevo Endpoint: Buscar Producto

```javascript
// NUEVO ENDPOINT PARA PRODUCCIÓN
POST /api/product/search

Request:
{
  "productId": "ASP001",        // Identificador a buscar
  "searchColumnIndex": 1,        // Índice de columna donde buscar (ej: código)
  "returnAllColumns": true       // Retornar todos los campos o solo algunos
}

Response:
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Dosage": "500mg",
    "Route": "Oral",
    "Frequency": "As needed",
    "SideEffects": "May cause stomach upset",
    ...
  },
  "rowIndex": 42,
  "totalRows": 131,
  "searchTime": 245  // milisegundos
}
```

---

## Funciones Reutilizables

### 1. Backend: Leer Archivo Completo

**Ubicación**: `backend/network-path-handler-windows.js`

**Función Existente**: `readFile(options)`

```javascript
/**
 * Lee archivo completo (no solo primeras líneas)
 * 
 * @param {Object} options
 * @param {string} options.path - Ruta SMB
 * @param {string} options.filename - Nombre del archivo
 * @param {string} options.username - Usuario (opcional)
 * @param {string} options.password - Contraseña (opcional)
 * @param {string} options.domain - Dominio (opcional)
 * 
 * @returns {Promise<string>} Contenido completo del archivo
 */
async readFile(options) {
  // Implementación actual
}
```

**Uso en Producción**:

```javascript
// En server.js - Nuevo endpoint

app.post('/api/product/search', async (req, res) => {
  try {
    const { productId, searchColumnIndex, returnAllColumns } = req.body;
    
    // 1. Cargar configuración guardada
    const config = JSON.parse(fs.readFileSync('config/app-config.json', 'utf8'));
    const connectorConfig = config.connection;
    const parserConfig = config.parser;
    
    // 2. Inicializar handlers
    const credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    const handler = new NetworkPathHandlerWindows(credentialCrypto);
    
    // 3. Desencriptar contraseña
    let password = connectorConfig.password;
    if (credentialCrypto && password) {
      password = await credentialCrypto.decrypt(password);
    }
    
    // 4. Leer archivo COMPLETO
    const fileContent = await handler.readFile({
      path: connectorConfig.path,
      filename: connectorConfig.filename,
      username: connectorConfig.username,
      password: password,
      domain: connectorConfig.domain
    });
    
    // 5. Parsear archivo
    const rows = parseCSVContent(
      fileContent,
      parserConfig.delimiter,
      parserConfig.hasHeader,
      parserConfig.quoteChar,
      parserConfig.escapeChar
    );
    
    // 6. Buscar producto
    const result = searchProductInRows(
      rows,
      productId,
      searchColumnIndex,
      parserConfig.columnNames
    );
    
    // 7. Retornar resultado
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      found: false
    });
  }
});
```

---

### 2. Backend: Parsear CSV Completo

**Nueva Función**: `parseCSVContent()`

```javascript
/**
 * Parsea contenido CSV completo
 * 
 * @param {string} content - Contenido del archivo
 * @param {string} delimiter - Delimitador (ej: ',')
 * @param {boolean} hasHeader - Si tiene encabezado
 * @param {string} quoteChar - Carácter de comilla (ej: '"')
 * @param {string} escapeChar - Carácter de escape (ej: '"')
 * 
 * @returns {Array<Object>} Array de objetos (cada objeto = una fila)
 */
function parseCSVContent(content, delimiter, hasHeader, quoteChar, escapeChar) {
  const lines = content.split('\n').filter(line => line.trim());
  const rows = [];
  
  // Saltar header si existe
  const startIndex = hasHeader ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter, quoteChar, escapeChar);
    rows.push(fields);
  }
  
  return rows;
}

/**
 * Parsea una línea CSV
 * Reutiliza lógica del frontend
 */
function parseCSVLine(line, delimiter, quoteChar, escapeChar) {
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
```

---

### 3. Backend: Buscar Producto

**Nueva Función**: `searchProductInRows()`

```javascript
/**
 * Busca producto en array de filas
 * 
 * @param {Array<Array>} rows - Array de filas parseadas
 * @param {string} productId - Identificador a buscar
 * @param {number} searchColumnIndex - Índice de columna donde buscar
 * @param {Array<string>} columnNames - Nombres de columnas
 * 
 * @returns {Object} Resultado de búsqueda
 */
function searchProductInRows(rows, productId, searchColumnIndex, columnNames) {
  const startTime = Date.now();
  
  // Buscar fila que coincida
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Verificar que el índice existe
    if (searchColumnIndex >= row.length) {
      continue;
    }
    
    // Comparar valor
    if (row[searchColumnIndex].toString().trim() === productId.toString().trim()) {
      // Encontrado - convertir a objeto
      const product = {};
      columnNames.forEach((colName, idx) => {
        product[colName] = row[idx] || '';
      });
      
      const searchTime = Date.now() - startTime;
      
      return {
        found: true,
        product: product,
        rowIndex: i,
        totalRows: rows.length,
        searchTime: searchTime
      };
    }
  }
  
  // No encontrado
  const searchTime = Date.now() - startTime;
  
  return {
    found: false,
    product: null,
    rowIndex: -1,
    totalRows: rows.length,
    searchTime: searchTime
  };
}
```

---

### 4. Backend: Búsqueda Avanzada

**Función Opcional**: `searchProductAdvanced()`

```javascript
/**
 * Búsqueda avanzada con múltiples opciones
 * 
 * @param {Array<Array>} rows - Array de filas
 * @param {Object} searchCriteria - Criterios de búsqueda
 * @param {Array<string>} columnNames - Nombres de columnas
 * 
 * @returns {Object} Resultados
 */
function searchProductAdvanced(rows, searchCriteria, columnNames) {
  const startTime = Date.now();
  const results = [];
  
  // searchCriteria puede ser:
  // { columnName: "Code", value: "ASP001", exact: true }
  // { columnName: "MedicationName", value: "Aspirin", exact: false }
  
  const searchColumnIndex = columnNames.indexOf(searchCriteria.columnName);
  if (searchColumnIndex === -1) {
    return {
      found: false,
      results: [],
      error: `Column "${searchCriteria.columnName}" not found`
    };
  }
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cellValue = row[searchColumnIndex].toString().trim();
    const searchValue = searchCriteria.value.toString().trim();
    
    let matches = false;
    
    if (searchCriteria.exact) {
      matches = cellValue === searchValue;
    } else {
      matches = cellValue.toLowerCase().includes(searchValue.toLowerCase());
    }
    
    if (matches) {
      const product = {};
      columnNames.forEach((colName, idx) => {
        product[colName] = row[idx] || '';
      });
      
      results.push({
        product: product,
        rowIndex: i
      });
    }
  }
  
  const searchTime = Date.now() - startTime;
  
  return {
    found: results.length > 0,
    results: results,
    totalFound: results.length,
    searchTime: searchTime
  };
}
```

---

## Formato de Datos

### Configuración Guardada (config/app-config.json)

```json
{
  "connection": {
    "connectorType": "networkPath",
    "type": "Network Path",
    "path": "\\\\Laptop-fjiolk7l\\new",
    "fileNamePattern": "*.csv",
    "filename": "w.csv",
    "useAuthentication": true,
    "username": "client",
    "password": "enc:v1:aes-gcm:aBcDeFgHiJkLmN==:xYzAbCdEfGhIjKlMnOpQrStUvWxYz==",
    "useDomain": false,
    "domain": ""
  },
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "quoteChar": "\"",
    "escapeChar": "\"",
    "columnNames": [
      "MedicationName",
      "Code",
      "Dosage",
      "Route",
      "Frequency",
      "SideEffects",
      "Contraindications",
      "Interactions",
      "StorageConditions",
      "ExpiryDate",
      "Manufacturer",
      "BatchNumber",
      "Price",
      "Quantity",
      "ReorderLevel",
      "Supplier",
      "SupplierContact",
      "LastUpdated",
      "Notes",
      "Status",
      "ApprovedBy",
      "DateApproved"
    ],
    "columns": [
      { "name": "MedicationName", "index": 0 },
      { "name": "Code", "index": 1 },
      { "name": "Dosage", "index": 2 },
      { "name": "Route", "index": 3 },
      { "name": "Frequency", "index": 4 },
      { "name": "SideEffects", "index": 5 },
      { "name": "Contraindications", "index": 6 },
      { "name": "Interactions", "index": 7 },
      { "name": "StorageConditions", "index": 8 },
      { "name": "ExpiryDate", "index": 9 },
      { "name": "Manufacturer", "index": 10 },
      { "name": "BatchNumber", "index": 11 },
      { "name": "Price", "index": 12 },
      { "name": "Quantity", "index": 13 },
      { "name": "ReorderLevel", "index": 14 },
      { "name": "Supplier", "index": 15 },
      { "name": "SupplierContact", "index": 16 },
      { "name": "LastUpdated", "index": 17 },
      { "name": "Notes", "index": 18 },
      { "name": "Status", "index": 19 },
      { "name": "ApprovedBy", "index": 20 },
      { "name": "DateApproved", "index": 21 }
    ]
  }
}
```

### Formato de Respuesta: Búsqueda Exitosa

```json
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Dosage": "500mg",
    "Route": "Oral",
    "Frequency": "As needed",
    "SideEffects": "May cause stomach upset",
    "Contraindications": "Allergic to salicylates",
    "Interactions": "Warfarin, NSAIDs",
    "StorageConditions": "Room temperature",
    "ExpiryDate": "2025-12-31",
    "Manufacturer": "PharmaCorp",
    "BatchNumber": "B12345",
    "Price": "5.99",
    "Quantity": "1000",
    "ReorderLevel": "100",
    "Supplier": "MedSupply Inc",
    "SupplierContact": "contact@medsupply.com",
    "LastUpdated": "2024-01-15",
    "Notes": "Popular over-the-counter pain reliever",
    "Status": "Active",
    "ApprovedBy": "Dr. Smith",
    "DateApproved": "2023-06-01"
  },
  "rowIndex": 42,
  "totalRows": 131,
  "searchTime": 245
}
```

### Formato de Respuesta: Búsqueda sin Resultados

```json
{
  "found": false,
  "product": null,
  "rowIndex": -1,
  "totalRows": 131,
  "searchTime": 12
}
```

### Formato de Respuesta: Búsqueda Avanzada

```json
{
  "found": true,
  "results": [
    {
      "product": {
        "MedicationName": "Aspirin",
        "Code": "ASP001",
        ...
      },
      "rowIndex": 42
    },
    {
      "product": {
        "MedicationName": "Aspirin Extended Release",
        "Code": "ASP002",
        ...
      },
      "rowIndex": 43
    }
  ],
  "totalFound": 2,
  "searchTime": 156
}
```

---

## Ejemplos Prácticos

### Ejemplo 1: Búsqueda Simple por Código

```bash
# Request
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ASP001",
    "searchColumnIndex": 1,
    "returnAllColumns": true
  }'

# Response
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Dosage": "500mg",
    ...
  },
  "rowIndex": 42,
  "totalRows": 131,
  "searchTime": 245
}
```

---

### Ejemplo 2: Búsqueda por Nombre de Medicamento

```bash
# Request
curl -X POST http://localhost:3000/api/product/search-advanced \
  -H "Content-Type: application/json" \
  -d '{
    "searchCriteria": {
      "columnName": "MedicationName",
      "value": "Aspirin",
      "exact": false
    }
  }'

# Response
{
  "found": true,
  "results": [
    {
      "product": {
        "MedicationName": "Aspirin",
        "Code": "ASP001",
        ...
      },
      "rowIndex": 42
    },
    {
      "product": {
        "MedicationName": "Aspirin Extended Release",
        "Code": "ASP002",
        ...
      },
      "rowIndex": 43
    }
  ],
  "totalFound": 2,
  "searchTime": 156
}
```

---

### Ejemplo 3: Búsqueda en Entorno Real (JavaScript)

```javascript
// En el entorno real (otra aplicación)

async function findMedication(productCode) {
  try {
    const response = await fetch('http://localhost:3000/api/product/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: productCode,
        searchColumnIndex: 1,  // Columna "Code"
        returnAllColumns: true
      })
    });
    
    const result = await response.json();
    
    if (result.found) {
      console.log('Medicamento encontrado:');
      console.log(`Nombre: ${result.product.MedicationName}`);
      console.log(`Código: ${result.product.Code}`);
      console.log(`Dosis: ${result.product.Dosage}`);
      console.log(`Precio: $${result.product.Price}`);
      console.log(`Cantidad disponible: ${result.product.Quantity}`);
      console.log(`Tiempo de búsqueda: ${result.searchTime}ms`);
      
      return result.product;
    } else {
      console.log('Medicamento no encontrado');
      return null;
    }
    
  } catch (error) {
    console.error('Error en búsqueda:', error);
    return null;
  }
}

// Uso
const medication = await findMedication('ASP001');
```

---

## Endpoints para Producción

### 1. POST /api/product/search

**Búsqueda simple por identificador**

```
POST /api/product/search
Content-Type: application/json

{
  "productId": "ASP001",
  "searchColumnIndex": 1,
  "returnAllColumns": true
}

Response: 200 OK
{
  "found": true,
  "product": {...},
  "rowIndex": 42,
  "totalRows": 131,
  "searchTime": 245
}
```

---

### 2. POST /api/product/search-advanced

**Búsqueda avanzada con criterios múltiples**

```
POST /api/product/search-advanced
Content-Type: application/json

{
  "searchCriteria": {
    "columnName": "MedicationName",
    "value": "Aspirin",
    "exact": false
  }
}

Response: 200 OK
{
  "found": true,
  "results": [...],
  "totalFound": 2,
  "searchTime": 156
}
```

---

### 3. POST /api/product/search-multiple

**Búsqueda de múltiples productos**

```
POST /api/product/search-multiple
Content-Type: application/json

{
  "productIds": ["ASP001", "IBU002", "ACE003"],
  "searchColumnIndex": 1
}

Response: 200 OK
{
  "found": 3,
  "notFound": 0,
  "results": [
    { "productId": "ASP001", "product": {...}, "rowIndex": 42 },
    { "productId": "IBU002", "product": {...}, "rowIndex": 43 },
    { "productId": "ACE003", "product": {...}, "rowIndex": 44 }
  ],
  "totalSearchTime": 512
}
```

---

### 4. GET /api/product/all

**Obtener todos los productos (opcional, para caché)**

```
GET /api/product/all

Response: 200 OK
{
  "products": [
    {
      "MedicationName": "Aspirin",
      "Code": "ASP001",
      ...
    },
    ...
  ],
  "totalProducts": 131,
  "loadTime": 1245
}
```

---

### 5. POST /api/product/filter

**Filtrar productos por criterios**

```
POST /api/product/filter
Content-Type: application/json

{
  "filters": [
    { "columnName": "Status", "value": "Active" },
    { "columnName": "Price", "value": "10", "operator": "lessThan" }
  ],
  "limit": 50
}

Response: 200 OK
{
  "found": true,
  "results": [...],
  "totalFound": 23,
  "filterTime": 345
}
```

---

## Guía de Integración

### Paso 1: Agregar Funciones de Búsqueda al Backend

**Archivo**: `server.js`

```javascript
// Importar funciones de parsing
import { parseCSVLine, parseCSVContent, searchProductInRows } from './backend/csv-utils.js';

// Endpoint de búsqueda simple
app.post('/api/product/search', async (req, res) => {
  try {
    const { productId, searchColumnIndex } = req.body;
    
    // Cargar configuración
    const config = JSON.parse(fs.readFileSync('config/app-config.json', 'utf8'));
    
    // Leer archivo
    const credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
    const handler = new NetworkPathHandlerWindows(credentialCrypto);
    
    const password = await credentialCrypto.decrypt(config.connection.password);
    const fileContent = await handler.readFile({
      path: config.connection.path,
      filename: config.connection.filename,
      username: config.connection.username,
      password: password
    });
    
    // Parsear
    const rows = parseCSVContent(
      fileContent,
      config.parser.delimiter,
      config.parser.hasHeader,
      config.parser.quoteChar,
      config.parser.escapeChar
    );
    
    // Buscar
    const result = searchProductInRows(
      rows,
      productId,
      searchColumnIndex,
      config.parser.columnNames
    );
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message, found: false });
  }
});
```

---

### Paso 2: Crear Archivo de Utilidades CSV

**Archivo**: `backend/csv-utils.js`

```javascript
/**
 * Utilidades para parsing y búsqueda de CSV
 * Reutilizables en múltiples endpoints
 */

export function parseCSVLine(line, delimiter, quoteChar, escapeChar) {
  // Implementación...
}

export function parseCSVContent(content, delimiter, hasHeader, quoteChar, escapeChar) {
  // Implementación...
}

export function searchProductInRows(rows, productId, searchColumnIndex, columnNames) {
  // Implementación...
}

export function searchProductAdvanced(rows, searchCriteria, columnNames) {
  // Implementación...
}
```

---

### Paso 3: Usar en Entorno Real

```javascript
// En tu aplicación real

import { searchMedication } from './api-client.js';

async function handleMedicationSearch(productCode) {
  const result = await searchMedication(productCode);
  
  if (result.found) {
    // Mostrar datos del medicamento
    displayMedicationDetails(result.product);
  } else {
    // Mostrar mensaje de no encontrado
    showNotFoundMessage();
  }
}
```

---

## Optimizaciones para Producción

### 1. Caché en Memoria

```javascript
// Cargar archivo una sola vez en memoria
let cachedRows = null;
let cacheTimestamp = null;
const CACHE_DURATION = 3600000; // 1 hora

async function getCachedRows(config) {
  const now = Date.now();
  
  if (cachedRows && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedRows;
  }
  
  // Cargar archivo
  const fileContent = await readFile(config);
  cachedRows = parseCSVContent(fileContent, config.parser.delimiter, ...);
  cacheTimestamp = now;
  
  return cachedRows;
}
```

---

### 2. Índices para Búsqueda Rápida

```javascript
// Crear índice por código para búsqueda O(1)
function createIndex(rows, columnIndex) {
  const index = {};
  
  rows.forEach((row, rowIndex) => {
    const key = row[columnIndex].toString().trim();
    index[key] = rowIndex;
  });
  
  return index;
}

// Usar índice
function searchWithIndex(rows, productId, index, columnNames) {
  const rowIndex = index[productId];
  
  if (rowIndex === undefined) {
    return { found: false };
  }
  
  const row = rows[rowIndex];
  const product = {};
  columnNames.forEach((col, idx) => {
    product[col] = row[idx];
  });
  
  return { found: true, product, rowIndex };
}
```

---

### 3. Búsqueda Paralela (Múltiples Productos)

```javascript
async function searchMultipleProducts(productIds, config) {
  const rows = await getCachedRows(config);
  const index = createIndex(rows, 1); // Índice por código
  
  const results = await Promise.all(
    productIds.map(productId => 
      searchWithIndex(rows, productId, index, config.parser.columnNames)
    )
  );
  
  return results;
}
```

---

## Resumen

| Aspecto | Fase 1 (Testing) | Fase 2 (Producción) |
|--------|-----------------|-------------------|
| **Objetivo** | Validar configuración | Buscar productos |
| **Filas leídas** | 10 (preview) | Todas |
| **Función clave** | `validateConfiguration()` | `searchProductInRows()` |
| **Endpoint** | `/api/connector/read-file` | `/api/product/search` |
| **Formato respuesta** | Preview + logs | Producto encontrado |
| **Reutilización** | Configuración guardada | Mismo parsing |

---

## Próximos Pasos

1. **Crear archivo `backend/csv-utils.js`** con funciones reutilizables
2. **Agregar endpoints de búsqueda** a `server.js`
3. **Implementar caché** para optimizar búsquedas
4. **Crear índices** para búsqueda rápida
5. **Documentar API** de búsqueda para otros equipos
6. **Testing** de búsqueda en entorno real

¿Necesitas ayuda implementando alguno de estos pasos?
