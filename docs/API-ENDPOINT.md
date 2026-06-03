# API Reference — INT5

Base URL: `http://localhost:3000` (o `http://int5:3000` / `http://int5.local:3000`)

---

## Índice

- [Configuración](#configuración)
- [Conector](#conector)
- [Importación (endpoint principal)](#importación-endpoint-principal)
- [Sync Log](#sync-log)
- [Búsqueda y consulta](#búsqueda-y-consulta)

---

## Configuración

### `POST /api/config/save`

Guarda una sección de la configuración. Cada tab guarda únicamente su sección; el backend hace merge con las demás.

**Secciones disponibles:** `connection` | `parser` | `mapping` | `validation` | `persistence`

**Ejemplo — guardar mapping:**
```json
{
  "mapping": [
    { "csvColumn": "MedCode",   "index": 0, "jsonTag": "code",   "include": true },
    { "csvColumn": "MedName",   "index": 1, "jsonTag": "name",   "include": true },
    { "csvColumn": "InternalId","index": 2, "jsonTag": "id",     "include": false }
  ]
}
```

**Respuesta:**
```json
{
  "status": "SUCCESS",
  "message": "Configuration saved"
}
```

---

### `GET /api/config/load`

Devuelve la configuración completa guardada.

**Respuesta (con configuración):**
```json
{
  "status": "SUCCESS",
  "config": {
    "connection":  { ... },
    "parser":      { ... },
    "mapping":     [ ... ],
    "validation":  [ ... ],
    "persistence": { "triggerMode": "auto" }
  }
}
```

**Respuesta (sin configuración):**
```json
{ "status": "NOT_FOUND", "config": null }
```

---

### `DELETE /api/config/clear`

Elimina la configuración guardada. Crea un backup automático antes de borrar.

**Respuesta:**
```json
{ "status": "SUCCESS", "message": "Configuration cleared" }
```

---

## Conector

### `POST /test-connection`

Prueba la conexión SMB y detecta el archivo que coincide con el patrón. Usado por el Tab 1 del wizard.

**Request:**
```json
{
  "path":     "\\\\servidor\\compartida\\carpeta",
  "username": "usuario",
  "password": "contraseña",
  "domain":   "DOMINIO",
  "pattern":  "medications_*.csv"
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `path` | Sí | Ruta UNC (debe comenzar con `\\`) |
| `pattern` | Sí | Patrón de archivo (`*` como wildcard) |
| `username` | No | Usuario SMB |
| `password` | No | Contraseña |
| `domain` | No | Dominio Windows |

**Respuesta (éxito):**
```json
{
  "status": "READY",
  "file":   "medications_20260602.csv",
  "logs":   ["✓ Folder accessible", "✓ File selected: medications_20260602.csv"]
}
```

**Respuesta (error):**
```json
{
  "status": "FAILED",
  "file":   null,
  "logs":   ["✗ Access is denied"]
}
```

---

### `POST /api/connector/read-file`

Lee el contenido de un archivo CSV desde la ruta SMB. Usado internamente por el Tab 2 (Parser preview).

**Request:**
```json
{
  "connectorType":    "networkPath",
  "path":             "\\\\servidor\\compartida\\carpeta",
  "fileNamePattern":  "*.csv",
  "useAuthentication": true,
  "username":         "usuario",
  "password":         "contraseña"
}
```

**Respuesta:**
```json
{
  "content":  "col1,col2,col3\nval1,val2,val3\n...",
  "filename": "medications_20260602.csv",
  "size":     48320,
  "encoding": "UTF-8"
}
```

---

## Importación (endpoint principal)

### `POST /api/product/import`

**Este es el endpoint que llama CORINA.** Busca el producto en el CSV, aplica mapping, valida campos requeridos, cachea el producto y registra el resultado en el sync log.

**Request:**
```json
{
  "productCode":       "ASP001",
  "searchColumnIndex": 0,
  "confirmed":         false
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `productCode` | Sí | Código del producto a buscar |
| `searchColumnIndex` | Sí | Índice de la columna donde buscar (0-based) |
| `confirmed` | No | `true` para confirmar en modo Manual (default: `false`) |

**Respuestas:**

**IMPORTED** — encontrado, validado e importado:
```json
{
  "status":         "IMPORTED",
  "productCode":    "ASP001",
  "product":        { "code": "ASP001", "name": "Aspirina 100mg", "dose": "100mg" },
  "fieldsImported": 3,
  "rowIndex":       42
}
```

**NOT_FOUND** — no existe en el CSV:
```json
{
  "status":      "NOT_FOUND",
  "productCode": "XYZ999"
}
```

**VALIDATION_FAILED** — campo requerido vacío:
```json
{
  "status":      "VALIDATION_FAILED",
  "productCode": "ASP001",
  "message":     "Product found in CSV but with incomplete data — field [dose] is empty"
}
```

**CONFIRMATION_REQUIRED** — modo Manual, esperando confirmación:
```json
{
  "status":      "CONFIRMATION_REQUIRED",
  "productCode": "ASP001",
  "message":     "Product \"ASP001\" found. Confirm import?",
  "preview":     { "code": "ASP001", "name": "Aspirina 100mg", "dose": "100mg" }
}
```
→ Para confirmar, reenviar con `"confirmed": true`.

**ERROR** — fallo de configuración o conexión:
```json
{
  "status": "ERROR",
  "error":  "Parser not configured: no columns defined. Complete the Parser tab first."
}
```

---

## Sync Log

### `GET /api/sync-log`

Devuelve el historial de todas las llamadas a `/api/product/import`, ordenado del más reciente al más antiguo. Nunca se borra.

**Query params:**

| Parámetro | Default | Máx | Descripción |
|-----------|---------|-----|-------------|
| `page` | `1` | — | Página (1-based) |
| `limit` | `20` | `100` | Entradas por página |

**Ejemplo:** `GET /api/sync-log?page=2&limit=10`

**Respuesta:**
```json
{
  "entries": [
    {
      "id":             "1717430412345-823401",
      "timestamp":      "2026-06-03T14:22:05.123Z",
      "productCode":    "ASP001",
      "result":         "FOUND",
      "fieldsImported": 3,
      "error":          ""
    },
    {
      "id":             "1717430300000-100001",
      "timestamp":      "2026-06-03T14:20:00.000Z",
      "productCode":    "IBU999",
      "result":         "NOT_FOUND",
      "fieldsImported": 0,
      "error":          ""
    }
  ],
  "total":      42,
  "page":       2,
  "totalPages": 5
}
```

**Valores posibles de `result`:**

| Valor | Descripción |
|-------|-------------|
| `FOUND` | Importado correctamente |
| `NOT_FOUND` | No existe en el CSV |
| `VALIDATION_FAILED` | Campo requerido vacío |
| `ERROR` | Error de sistema (conexión, config) |

---

## Búsqueda y consulta

Estos endpoints son para consultas directas al CSV sin pasar por el flujo de validación/import.

### `POST /api/product/search`

Busca un producto por valor exacto en una columna.

**Request:**
```json
{
  "productId":         "ASP001",
  "searchColumnIndex": 0
}
```

**Respuesta:**
```json
{
  "found":      true,
  "product":    { "code": "ASP001", "name": "Aspirina 100mg" },
  "rowIndex":   42,
  "totalRows":  131,
  "searchTime": 12
}
```

---

### `POST /api/product/search-advanced`

Búsqueda con operador (`contains` / `equals`) y sensibilidad a mayúsculas.

**Request:**
```json
{
  "searchCriteria": {
    "columnName":    "MedName",
    "value":         "Aspirina",
    "exact":         false,
    "caseSensitive": false
  }
}
```

---

### `POST /api/product/search-multiple`

Busca varios códigos en una sola llamada.

**Request:**
```json
{
  "productIds":        ["ASP001", "IBU002", "ACE003"],
  "searchColumnIndex": 0
}
```

**Respuesta:**
```json
{
  "products":   [ { "productId": "ASP001", "found": true, "product": {...}, "rowIndex": 42 }, ... ],
  "totalFound": 2,
  "totalSearched": 3
}
```

---

### `POST /api/product/filter`

Filtra productos por múltiples columnas.

**Request:**
```json
{
  "filters": [
    { "columnName": "Status", "value": "Active" }
  ]
}
```

---

### `GET /api/product/all`

Devuelve todos los productos del CSV con mapping aplicado.

---

### `GET /api/product/stats`

Estadísticas del CSV (total de filas, columnas, valores únicos, etc.).

---

## Notas generales

- Todos los endpoints de producto usan `loadProductionContext()` — requieren que los tabs 1 y 2 estén configurados y guardados.
- El mapping (Tab 3) se aplica a todos los endpoints: las claves del `product` en el response son los `jsonTag`, no los nombres de columna del CSV.
- Los errores de configuración devuelven HTTP 400; los errores de servidor devuelven HTTP 500.
