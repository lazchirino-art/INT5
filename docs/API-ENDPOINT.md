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
    { "csvColumn": "MedCode", "index": 0, "jsonTag": "code", "include": true },
    { "csvColumn": "MedName", "index": 1, "jsonTag": "name", "include": true }
  ]
}
```

> En el flujo **CSV** todas las columnas configuradas en el Parser se exponen (el campo `include` se guarda siempre `true`; ya no hay checkbox de Include en la pestaña Mapping del wizard CSV). En el wizard **API-RESP** sí existe Include, porque el esquema se auto-detecta y hay que elegir entre todos los campos.

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
    "persistence": { "triggerMode": "manual", "validationLevel": "superior" },
    "apiResp":     { ... }
  }
}
```

> `persistence.validationLevel` (`"superior"` | `"same"`) solo aplica cuando `triggerMode` es `"manual"`. La sección `apiResp` contiene la configuración del wizard API-RESP (connector, schema, mapping, validation, persistence).

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
  "confirmed":         false,
  "requestedBy":       "operador.juan",
  "confirmedBy":       "supervisor.ana"
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `productCode` | Sí | Código del producto a buscar |
| `searchColumnIndex` | Sí | Índice de la columna donde buscar (0-based) |
| `confirmed` | No | `true` para confirmar en modo Manual (default: `false`) |
| `requestedBy` | No | Operador (login del software de producción) que dispara la petición. Se registra en el log. Default: `"unknown"` |
| `confirmedBy` | No | Operador/supervisor que valida (modo Manual, en la llamada con `confirmed: true`). Se registra en el log |

> **Contrato con la app de producción:** INT5 no gestiona usuarios. La app de producción (que tiene el login del operador) **debe enviar** `requestedBy` (y `confirmedBy` al confirmar) en cada llamada. INT5 solo los registra en el log.

**Respuestas:**

**IMPORTED** — encontrado, validado e importado:
```json
{
  "status":      "IMPORTED",
  "productCode": "ASP001",
  "product":     { "code": "ASP001", "name": "Aspirina 100mg", "dose": "100mg" },
  "rowIndex":    42
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
  "status":          "CONFIRMATION_REQUIRED",
  "productCode":     "ASP001",
  "message":         "Product \"ASP001\" found. Confirm import?",
  "validationLevel": "superior",
  "preview":         { "code": "ASP001", "name": "Aspirina 100mg", "dose": "100mg" }
}
```
→ Para confirmar, reenviar con `"confirmed": true` (y `confirmedBy`).

El campo **`validationLevel`** (`"superior"` | `"same"`) indica a la app de producción qué mostrar al validar:
- `"superior"` → pedir login de un usuario/supervisor de nivel superior.
- `"same"` → solo un botón "verificado por el mismo operador".

Se configura en la pestaña Persistence (solo aplica en modo Manual).

**ERROR** — fallo de configuración o conexión:
```json
{
  "status": "ERROR",
  "error":  "Parser not configured: no columns defined. Complete the Parser tab first."
}
```

---

### `POST /api/product/import-api`

Equivalente a `/api/product/import` pero para la integración **API-RESP** (consume un endpoint REST externo en vez de leer un CSV). Mismo contrato de request/response (`requestedBy`, `confirmedBy`, `confirmed`, `validationLevel`, estados `IMPORTED` / `NOT_FOUND` / `VALIDATION_FAILED` / `CONFIRMATION_REQUIRED` / `ERROR`). No requiere `searchColumnIndex` (el producto se pide por `productCode` directamente a la API externa). Las entradas que genera en el sync log llevan `source: "apiResp"`.

Endpoints auxiliares del wizard API-RESP:
- `POST /api/apiResp/test-connection` — prueba el endpoint externo y detecta los campos del JSON.

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
      "id":          "1717430412345-823401",
      "timestamp":   "2026-06-03T14:22:05.123Z",
      "productCode": "ASP001",
      "result":      "FOUND",
      "requestedBy": "operador.juan",
      "confirmedBy": "supervisor.ana",
      "fields":      { "code": "ASP001", "name": "Aspirina 100mg", "dose": "100mg" },
      "error":       ""
    },
    {
      "id":          "1717430300000-100001",
      "timestamp":   "2026-06-03T14:20:00.000Z",
      "productCode": "IBU999",
      "result":      "NOT_FOUND",
      "requestedBy": "operador.juan",
      "confirmedBy": null,
      "fields":      null,
      "error":       ""
    }
  ],
  "total":      42,
  "page":       2,
  "totalPages": 5
}
```

> **Nota:** el log guarda los **valores de cada columna configurada** del producto en `fields` (no un contador). `fields` es `null` cuando no hay producto (NOT_FOUND/ERROR) y parcial en VALIDATION_FAILED. También registra el operador (`requestedBy` / `confirmedBy`).

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
