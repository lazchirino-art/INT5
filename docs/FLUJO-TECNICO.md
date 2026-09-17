# INT5 — Flujo Técnico (interno del software)

> **Flujo interno** (CSV): funciones, módulos, transformaciones de datos y
> persistencia, paso a paso. Orientado a desarrolladores.
>
> Para el flujo **de uso** (operador / pantalla) ver **[FLUJO-DE-USO.md](FLUJO-DE-USO.md)**.
> Visión global en **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**
> y contrato en **[API-ENDPOINT.md](API-ENDPOINT.md)**.

Versión: 2026-06-18.

---

## Componentes internos (mapa de funciones)

**Backend**
- `server.js` — Express, define los endpoints. Funciones clave: `unwrap()` (merge config), `loadProductionContext()` (contexto de producción), `applyMapping()`/`applyMappingToList()`, `withSmbRetries()` + `sleep()` (reintentos solo de errores transitorios), `writeJsonAtomic()`, `safeSyncLog()`, `parseHasHeader()`.
- `backend/network-path-handler-windows.js` — clase `NetworkPathHandlerWindows`: `detect()`, `listFiles(path, creds, {force})`, `withShareAccess()`, `mount()`, `patternToRegex()`, `applyPattern()`, `selectFile()`, `readFile()`, `validatePath()`. Autentica con `net use` vía `execFile` (sin shell); lista con `fs.readdir` y lee con `fs.readFile` directamente sobre la ruta UNC.
- `backend/credential-crypto.js` — clase `CredentialCrypto`: `decrypt()`, `getCryptoKey()` (SHA-256 del secreto → clave AES), `base64ToBytes()`.
- `backend/csv-utils.js` — `parseCSVContent()`, `parseCSVLine()`, `searchProductInRows()`, `rowToObject()`, `formatValue()`.
- `backend/csv-utils.js` también: `parseDateWithFormat()` (Date Format → `yyyy-MM-dd`).
- `backend/local-db.js` — `insertSyncLog()`, `getSyncLog()`, `upsertProduct()`, `readJsonFile()`/`writeJsonFile()`/`ensureDataDir()`, `rotateSyncLogIfNeeded()`.

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
[Back] writeJsonAtomic(app-config.json, mergedConfig)   (escribe .tmp y renombra)
   ↓
[Back] Responde { status: SUCCESS, config: mergedConfig }
```
**load:** `readFileSync` → `JSON.parse` → `{ status: SUCCESS, config }` (o `NOT_FOUND`). Los archivos estáticos se sirven con `Cache-Control: no-cache`. La carpeta `config/` no se sirve por HTTP.

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
        2. validatePath(): valida estrictamente el formato UNC (\\servidor\recurso[\carpeta...])
        3. listFiles(path, creds, { force: true }) → withShareAccess():
               - con user/pass → mount(force): `net use \\servidor\recurso /delete /y` y luego
                 `net use \\servidor\recurso <pass> /user:[DOMINIO\]usuario /persistent:no`
                 (execFile, sin shell; montajes serializados; error 1219 → desmonta y reintenta)
               - sin user/pass → identidad de Windows del proceso
             fs.readdir(path) sobre la ruta UNC (timeout 15 s) → solo archivos
             Errores clasificados por código de Windows: AUTHENTICATION FAILED (86/1326),
             ACCOUNT RESTRICTED (1327/1330/1331/1909), ACCESS DENIED (5), SERVER NOT REACHABLE (53),
             SHARE NOT FOUND (67), CONNECTION LOST (59/64/121/1231), FOLDER REQUIRES CREDENTIALS
        4. applyPattern(files, pattern): patternToRegex (wildcard→regex) → filtra
        5. selectFile(matching): exige exactamente 1 (lanza si 0 o >1)
   ↓
[Back] Devuelve { status: READY|FAILED, file, logs[] }
   ↓
[Front] Renderiza logs + estado; si READY habilita Save
```
> 1 intento (acción manual). `force` remonta para verificar de verdad las credenciales. Editar cualquier campo del Connector anula el estado de test/guardado. SFTP está deshabilitado en el selector ("not available yet").

### Flujo interno — Save
```
[Front] credential-crypto.js (navegador): cifra password con AES-GCM → enc:v1:aes-gcm:iv:data
[Front] POST /api/config/save { connection: {..., password: "enc:..."} }
[Back] merge → writeJsonAtomic(app-config.json)
[Front] SAVE: SAVED (tras recargar la página, una conexión guardada también muestra SAVE: SAVED)
```

---

## Tab 2 — Parser

### Flujo de uso
El usuario define delimitador, Has Header, columnas (nombre/índice/tipo), pulsa **Check Configuration** (ve preview) y **Save**.

### Flujo interno — Check
```
[Front] parser-ui.js: Check solo habilitado si el Connector está guardado (SAVE: SAVED) y hay columnas
[Front] parser-ui.js: getUserColumns() + getParserConfig()
[Front] obtiene el contenido del archivo (POST /api/connector/read-file; el backend lo lee del SMB) y llama a
        csv-parser.js → CSVParser.validateConfiguration(connectorConfig, parserConfig):
          - detectDelimiter(): si el detectado difiere del configurado y separa más
            columnas → ERROR (status FAILED); el preview se parsea con el delimitador CONFIGURADO
          - parseCSVLine() (soporta escape distinto de la comilla, p. ej. \) de la cabecera o,
            si Has Header=No, autogenera columnNames por POSICIÓN (Column0, Column1, …)
          - valida que cada índice de usuario existe
          - recorre filas comprobando consistencia de nº de columnas (el error indica la fila)
          - genera preview = array posicional de filas (parseCSVLine por fila)
   ↓
[Front] parser-ui.js: validateUserColumnsAgainstFile() (compara nombres solo si Has Header=Yes)
   ↓
[Front] showPreview(preview, userColumns): pinta cada celda como row[col.index]
        (lee por COLUMN INDEX → coincide con lo que hará producción en rowToObject)
   ↓
[Front] updateCheckButtonState() / habilita Save solo si el status es VALID
        (editar, añadir o quitar columnas anula el Check)
```

### Flujo interno — Save
```
[Front] POST /api/config/save { parser: { delimiter, hasHeader, quoteChar, escapeChar, decimalSeparator, dateFormat, emptyValue, columns[...] } }
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
> Si las columnas del Parser cambian después de guardar el Mapping, o la Search Column ya no existe, el estado pasa a **OUTDATED — PARSER CHANGED, SAVE AGAIN** (Validation hace lo mismo con **OUTDATED — MAPPING CHANGED, SAVE AGAIN** si cambian los tags).

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
[Back] merge → app-config.json ; getSyncLog() lee data/sync-log.json (newest-first, paginado, filtro opcional ?source=apiResp|csv)
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
        2. Valida connection.path y (filename | fileNamePattern) y parser.columns;
           connectorType distinto de networkPath → 400
        3. useAuthentication / useDomain: si están a false no se usan credenciales / dominio
        4. CredentialCrypto.decrypt(password) si está cifrada
             (sin ENCRYPTION_SECRET o secreto distinto → 500 con mensaje claro; nunca usa el texto cifrado)
        5. new NetworkPathHandlerWindows(); creds = { username, password(desc), domain }
        6. withSmbRetries( async () => {           ← hasta 3 intentos, 10 s entre cada uno
              si no hay filename fijo:
                files = listFiles(path, creds)             (fs.readdir; reutiliza la sesión SMB
                                                            y solo monta con net use si falla)
                matching = applyPattern(files, fileNamePattern)
                filename = selectFile(matching)            (1 exacto)
              return handler.readFile({ path, filename, ...creds })
                                                           (fs.readFile; máx 50 MB, timeout 30 s;
                                                            caché por fecha de modificación + tamaño)
           })                                          ← solo se reintentan errores de red/servidor;
                                                          error.retryable === false (credenciales,
                                                          cuenta bloqueada, acceso denegado, 0 o >1
                                                          archivos, archivo grande) falla al instante
           Fallo → 400 si no reintentable, 502 si red/servidor
        7. csvUtils.parseCSVContent(fileContent, delimiter, parseHasHeader(hasHeader), quote, escape)
              → parseCSVLine por fila → rows: string[][]
        8. return { config, connectorConfig, parserConfig, mappingConfig, rows }
   ↓
[Back] effectiveSearchIndex = request.searchColumnIndex ?? config.searchColumnIndex
        (si ninguno → ERROR 400 "search column not configured";
         índice inválido → ERROR 500 "Review the Search Column in the Mapping tab")
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
              (internamente rowToObject ya leyó cada valor por col.index y aplicó formatValue por tipo:
               Empty Value Representation → "", Number con Decimal Separator, Date con Date Format → yyyy-MM-dd)
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
- `insertSyncLog(entry)`: `ensureDataDir()` → `rotateSyncLogIfNeeded()` (≥ 5 MB → renombra a `sync-log.<fecha>.json`) → `readJsonFile(sync-log.json, [])` → `push({ id, ...entry })` → `writeJsonFile()` (atómico: `.tmp` + renombrado). Append-only, no se purga. Desde `server.js` se llama vía `safeSyncLog()`, que captura el error para que la petición siempre reciba respuesta.
- `readJsonFile()`: si el JSON está corrupto lo renombra a `<archivo>.corrupt-<fecha>` y devuelve el valor por defecto (no sobrescribe el historial).
- `upsertProduct({ productCode, data })`: `readJsonFile(products.json, {})` → `cache[productCode] = { ...data, _updatedAt }` → `writeJsonFile()`.
- `getSyncLog({ page, limit, source })`: lee, filtra por `source` (`apiResp` | `csv`) si se indica, invierte (newest-first), pagina.

### Internos de cifrado (credential-crypto.js)
- `getCryptoKey()`: `TextEncoder` del `ENCRYPTION_SECRET` → `subtle.digest('SHA-256')` → `importKey('raw', ..., AES-GCM)`.
- `decrypt('enc:v1:aes-gcm:iv:data')`: separa, `base64ToBytes` de iv y data → `subtle.decrypt({AES-GCM, iv})` → texto.

---

## Resumen: endpoint + funciones internas por paso

| Paso | Endpoint | Funciones internas clave |
|------|----------|--------------------------|
| Connector test | `POST /test-connection` | `detect` → `decrypt` → `validatePath` → `listFiles({force})`/`withShareAccess`/`mount` → `applyPattern` → `selectFile` |
| Preview del Parser | `POST /api/connector/read-file` | `detect` → `readFile` |
| Guardar (cualquier tab) | `POST /api/config/save` | `unwrap` + merge por secciones → `writeJsonAtomic` |
| Cargar (cualquier tab) | `GET /api/config/load` | `readFileSync` → `JSON.parse` |
| Importar | `POST /api/product/import` | `loadProductionContext` (`withSmbRetries`→`listFiles`/`readFile`→`parseCSVContent`) → `searchProductInRows` → `applyMapping` → validación → `upsertProduct` + `safeSyncLog` |
| Columna de búsqueda | `GET /api/product/search-column` | lee `config.searchColumnIndex` + nombre de columna |
| Log | `GET /api/sync-log` | `getSyncLog` (reverse + paginado) |
