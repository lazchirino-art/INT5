# INT5 — Flujo de Trabajo (uso + flujo técnico interno)

> Documento de flujo **completo y actualizado** (CSV). Para cada pestaña del
> wizard y para la importación de producción se describe el **flujo de uso**
> (usuario/front) **y el flujo interno del software** (funciones, módulos,
> transformaciones de datos y persistencia, paso a paso).
>
> Complementa a **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**
> (visión global) y **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato de endpoints).

Versión: 2026-06-18.

---

## Componentes internos (mapa de funciones)

**Backend**
- `server.js` — Express, define los endpoints. Funciones clave: `unwrap()` (merge config), `loadProductionContext()` (contexto de producción), `applyMapping()`/`applyMappingToList()`, `withSmbRetries()` + `sleep()` (reintentos).
- `backend/network-path-handler-windows.js` — clase `NetworkPathHandlerWindows`: `detect()`, `listFilesViaPS()`, `buildPowerShellCommand()`, `patternToRegex()`, `applyPattern()`, `selectFile()`, `readFile()`, `validatePath()`.
- `backend/credential-crypto.js` — clase `CredentialCrypto`: `decrypt()`, `getCryptoKey()` (SHA-256 del secreto → clave AES), `base64ToBytes()`.
- `backend/csv-utils.js` — `parseCSVContent()`, `parseCSVLine()`, `searchProductInRows()`, `rowToObject()`, `formatValue()`.
- `backend/local-db.js` — `insertSyncLog()`, `getSyncLog()`, `upsertProduct()`, `readJsonFile()`/`writeJsonFile()`/`ensureDataDir()`.

**Frontend (vanilla JS)**
- `network-path-client.js` (HTTP), `credential-crypto.js` (cifrado AES-GCM en navegador), `config-loader.js` (carga al abrir), `csv-parser.js` (validación/preview), `parser-ui.js`, `mapping-ui.js`, `validation-ui.js`, `persistence-ui.js`, `csv-integration.js` (orquestación/tabs).

**Persistencia**
- `config/app-config.json` (configuración), `data/sync-log.json` (log append-only), `data/products.json` (caché).

---

## `/api/config/save` y `/api/config/load` (transversales)

Todas las pestañas guardan/cargan con estos dos. Flujo interno del **save**:

```
POST /api/config/save  con UNA sección, p.ej. { mapping: [...] }
   ↓
[Back] Lee la config actual (readFileSync app-config.json → JSON.parse), o {} si no existe
   ↓
[Back] unwrap(val, key): si una sección viene doble-anidada (connection.connection) la desempaqueta
   ↓
[Back] Construye mergedConfig tomando, por cada clave, la nueva si viene, si no la existente:
        connection, parser, mapping, validation, persistence, searchColumnIndex, apiResp
        (apiResp se mergea a su vez sub-sección a sub-sección)
   ↓
[Back] writeFileSync(app-config.json, JSON.stringify(mergedConfig, null, 2))
   ↓
[Back] Responde { status: SUCCESS, config: mergedConfig }
```
**load:** `readFileSync` → `JSON.parse` → `{ status: SUCCESS, config }` (o `NOT_FOUND`). Los archivos estáticos se sirven con `Cache-Control: no-cache`.

---

## Tab 1 — Connector

### Flujo de uso
El usuario rellena ruta + patrón (+ auth opcional), pulsa **Test Connection**; si sale READY, pulsa **Save Configuration**.

### Flujo interno — Test Connection
```
[Front] csv-integration.js: valida campos mínimos (path, patrón)
[Front] network-path-client.js: POST /test-connection { path, pattern, username?, password?, domain? }
   ↓
[Back] server.js (/test-connection) → new NetworkPathHandlerWindows(credentialCrypto)
   ↓
[Back] handler.detect(credentials):
        1. Si hay password cifrada → credentialCrypto.decrypt():
             getCryptoKey(): SHA-256(ENCRYPTION_SECRET) → importKey AES-GCM
             base64ToBytes(iv), base64ToBytes(data) → webcrypto.subtle.decrypt(AES-GCM)
        2. validatePath(): exige formato UNC (\\...)
        3. listFilesViaPS(path, creds):
             buildPowerShellCommand():
               - sin user/pass → `cmd /c dir <path>`
               - con user/pass → `net use <path> /user:[DOMINIO\]usuario pass & dir <path>`
             execAsync(cmd, timeout 10s)
             Parseа stdout línea a línea:
               - descarta líneas con <DIR> (carpetas, '.', '..'), cabeceras y resúmenes
               - se queda con líneas con fecha → extrae el nombre (parts.slice(3))
        4. applyPattern(files, pattern): patternToRegex (wildcard→regex) → filtra
        5. selectFile(matching): exige exactamente 1 (lanza si 0 o >1)
   ↓
[Back] Devuelve { status: READY|FAILED|PARTIAL, file, logs[] }
   ↓
[Front] Renderiza logs + estado; si READY habilita Save
```
> 1 intento (acción manual). Mensajes de error mapeados (system error 67/64/5, access denied, etc.).

### Flujo interno — Save
```
[Front] credential-crypto.js (navegador): cifra password con AES-GCM → enc:v1:aes-gcm:iv:data
[Front] POST /api/config/save { connection: {..., password: "enc:..."} }
[Back] merge → writeFileSync(app-config.json)
```

---

## Tab 2 — Parser

### Flujo de uso
El usuario define delimitador, Has Header, columnas (nombre/índice/tipo), pulsa **Check Configuration** (ve preview) y **Save**.

### Flujo interno — Check
```
[Front] parser-ui.js: getUserColumns() + getParserConfig()
[Front] obtiene el contenido del archivo (backend lo lee del SMB) y llama a
        csv-parser.js → CSVParser.validateConfiguration(connectorConfig, parserConfig):
          - parseCSVLine() de la cabecera o, si Has Header=No, autogenera
            columnNames por POSICIÓN (Column0, Column1, …)
          - valida que cada índice de usuario existe
          - recorre filas comprobando consistencia de nº de columnas
          - genera preview = array posicional de filas (parseCSVLine por fila)
   ↓
[Front] parser-ui.js: validateUserColumnsAgainstFile() (compara nombres solo si Has Header=Yes)
   ↓
[Front] showPreview(preview, userColumns): pinta cada celda como row[col.index]
        (lee por COLUMN INDEX → coincide con lo que hará producción en rowToObject)
   ↓
[Front] updateCheckButtonState() / habilita Save si todo correcto
```

### Flujo interno — Save
```
[Front] POST /api/config/save { parser: { delimiter, hasHeader, quoteChar, escapeChar, columns[...] } }
[Back] merge → app-config.json
[Front] updateStatusDisplay('SAVED'); MappingUI.loadFromParser() (auto-rellena Mapping)
```

---

## Tab 3 — Mapping

### Flujo de uso
Asigna un JSON tag a cada columna y elige la **Search Column** (la del código). Guarda.

### Flujo interno
```
[Front] Al entrar: mapping-ui.js loadFromParser() → GET /api/config/load
        - lee config.parser.columns → una fila por columna
        - índice de mapping guardado (savedMap por csvColumn) → restaura jsonTag
        - rellena el <select> Search Column con las columnas (value = índice)
   ↓
[Front] Usuario escribe tags + elige Search Column
   ↓
[Front] saveMapping():
        - valida tag no vacío en cada fila y que Search Column esté elegida
        - POST /api/config/save {
            mapping: [{ csvColumn, index, jsonTag, include: true }],
            searchColumnIndex
          }
   ↓
[Back] merge → app-config.json (mapping + searchColumnIndex)
```
> En CSV `include` siempre `true` (sin checkbox). `searchColumnIndex` queda guardado → producción solo envía `productCode`.

---

## Tab 4 — Validation

### Flujo interno
```
[Front] validation-ui.js loadFromMapping() → GET /api/config/load
        - toma config.mapping (include !== false)
        - restaura los "required" desde config.validation (savedRules por csvColumn)
   ↓
[Front] Usuario marca requeridos → saveRules():
        POST /api/config/save { validation: [{ csvColumn, jsonTag, required }] }
   ↓
[Back] merge → app-config.json
```
> En la importación, `required` vacío → `VALIDATION_FAILED`.

---

## Tab 5 — Persistence

### Flujo interno
```
[Front] persistence-ui.js:
        - toggleValidationLevel(): muestra "Validation Level" solo si Manual
        - saveConfig(): POST /api/config/save { persistence: { triggerMode, validationLevel? } }
        - loadConfig(): GET /api/config/load → restaura triggerMode/validationLevel
        - loadLog(page): GET /api/sync-log?page&limit → renderiza tabla (píldora + campos en línea)
   ↓
[Back] merge → app-config.json ; getSyncLog() lee data/sync-log.json (newest-first, paginado)
```

---

## Flujo de Importación (producción) — el núcleo

**Endpoint:** `POST /api/product/import`  ·  Body: `{ productCode, requestedBy, confirmed?, confirmedBy?, searchColumnIndex? }`

### Flujo interno completo
```
[Back] Valida que viene productCode
   ↓
[Back] loadProductionContext():
        1. readFileSync(app-config.json) → JSON.parse → config
        2. Valida connection.path y (filename | fileNamePattern) y parser.columns
        3. CredentialCrypto.decrypt(password) si está cifrada
        4. new NetworkPathHandlerWindows(crypto); creds = { username, password(desc), domain }
        5. withSmbRetries( async () => {           ← 3 intentos, 10 s entre cada uno
              si no hay filename fijo:
                files = listFilesViaPS(path, creds)        (dir por PowerShell)
                matching = applyPattern(files, fileNamePattern)
                filename = selectFile(matching)            (1 exacto)
              return handler.readFile({ path, filename, ...creds })  (type por cmd)
           })                                          ← solo se reintenta esta parte SMB
        6. csvUtils.parseCSVContent(fileContent, delimiter, hasHeader, quote, escape)
              → parseCSVLine por fila → rows: string[][]
        7. return { config, connectorConfig, parserConfig, mappingConfig, rows }
   ↓
[Back] effectiveSearchIndex = request.searchColumnIndex ?? config.searchColumnIndex
        (si ninguno → ERROR "search column not configured")
   ↓
[Back] csvUtils.searchProductInRows(rows, productCode, effectiveSearchIndex, parser.columns)
        → compara el valor de cada fila en esa columna (en memoria)
        │
        ├─ NO encontrado:
        │     insertSyncLog({ result:'NOT_FOUND', fields:null, requestedBy, confirmedBy })
        │     → { status: NOT_FOUND }
        │
        └─ Encontrado → applyMapping(product, mapping):
              por cada {csvColumn, jsonTag, include}: si include!==false → mapped[jsonTag] = product[csvColumn]
              (internamente rowToObject ya leyó cada valor por col.index y aplicó formatValue por tipo)
              ↓
           Validación: por cada regla required → si mapped[jsonTag] vacío:
              insertSyncLog({ result:'VALIDATION_FAILED', fields:mapped, ... })
              → { status: VALIDATION_FAILED, message }
              ↓
           triggerMode = config.persistence.triggerMode ; validationLevel = config.persistence.validationLevel
              ↓
           Si MANUAL y confirmed=false:
              → { status: CONFIRMATION_REQUIRED, validationLevel, preview: mapped }
              (NO insertSyncLog, NO upsertProduct)   ← no es acción completada
              Producción muestra login supervisor (superior) o botón (same)
              y reenvía con confirmed=true + confirmedBy
              ↓
           Auto, o Manual confirmado:
              upsertProduct({ productCode, data: mapped }) → data/products.json (caché)
              insertSyncLog({ result:'FOUND', fields:mapped, requestedBy, confirmedBy }) → data/sync-log.json
              → { status: IMPORTED, product: mapped }
```

### Internos de persistencia (local-db.js)
- `insertSyncLog(entry)`: `ensureDataDir()` → `readJsonFile(sync-log.json, [])` → `push({ id, ...entry })` → `writeJsonFile()`. Append-only, nunca se purga.
- `upsertProduct({ productCode, data })`: `readJsonFile(products.json, {})` → `cache[productCode] = { ...data, _updatedAt }` → `writeJsonFile()`.
- `getSyncLog({ page, limit })`: lee, invierte (newest-first), pagina.

### Internos de cifrado (credential-crypto.js)
- `getCryptoKey()`: `TextEncoder` del `ENCRYPTION_SECRET` → `subtle.digest('SHA-256')` → `importKey('raw', ..., AES-GCM)`.
- `decrypt('enc:v1:aes-gcm:iv:data')`: separa, `base64ToBytes` de iv y data → `subtle.decrypt({AES-GCM, iv})` → texto.

---

## Resumen: endpoint + funciones internas por paso

| Paso | Endpoint | Funciones internas clave |
|------|----------|--------------------------|
| Connector test | `POST /test-connection` | `detect` → `decrypt` → `validatePath` → `listFilesViaPS`/`buildPowerShellCommand` → `applyPattern` → `selectFile` |
| Guardar (cualquier tab) | `POST /api/config/save` | `unwrap` + merge por secciones → `writeFileSync` |
| Cargar (cualquier tab) | `GET /api/config/load` | `readFileSync` → `JSON.parse` |
| Importar | `POST /api/product/import` | `loadProductionContext` (`withSmbRetries`→`listFilesViaPS`/`readFile`→`parseCSVContent`) → `searchProductInRows` → `applyMapping` → validación → `upsertProduct` + `insertSyncLog` |
| Columna de búsqueda | `GET /api/product/search-column` | lee `config.searchColumnIndex` + nombre de columna |
| Log | `GET /api/sync-log` | `getSyncLog` (reverse + paginado) |
