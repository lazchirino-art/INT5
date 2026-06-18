# INT5 — Flujo de Trabajo (paso a paso, front y back)

> Documento de flujo **completo y actualizado** (CSV). Para cada pestaña del
> wizard y para el flujo de importación de producción se describe qué hace el
> usuario, el frontend, el backend y qué se devuelve/muestra.
>
> Complementa a **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**
> (visión global) y **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato).

Versión: 2026-06-18.

---

## Visión general

```
CONFIGURACIÓN (una vez, vía wizard)          OPERACIÓN (a diario, vía API)
─────────────────────────────────           ─────────────────────────────
1. Connector  → conexión SMB                 App de producción
2. Parser     → columnas/formato      ──►      POST /api/product/import
3. Mapping    → tags + col. búsqueda             ├─ lee CSV (SMB)
4. Validation → campos requeridos                ├─ busca + valida
5. Persistence→ modo + nivel valid.              ├─ confirma (manual)
                                                 └─ cachea + registra log
        ↓ todo se guarda en
        config/app-config.json
```

Cada pestaña **guarda solo su sección** (`/api/config/save` hace merge con el resto) y **recarga lo guardado** al volver a entrar.

---

## Tab 1 — Connector

**Objetivo:** definir el recurso SMB y validar que el archivo es accesible.

### Test Connection
```
[Front] El usuario rellena ruta, patrón, (auth opcional) y pulsa "Test Connection"
   ↓
[Front] csv-integration.js valida campos mínimos (path + patrón)
   ↓
[Front] network-path-client.js → POST /test-connection { path, pattern, username?, password?, domain? }
   ↓
[Back] server.js valida la ruta UNC (debe empezar por \\)
   ↓
[Back] network-path-handler-windows.js ejecuta por PowerShell/cmd:
        - sin auth:  cmd /c dir <ruta>
        - con auth:  net use <ruta> /user:[DOMINIO\]usuario pass & dir <ruta>
   ↓
[Back] Parsea la salida del dir (ignora <DIR>, cabeceras y resúmenes)
   ↓
[Back] Aplica el patrón (wildcard → regex) y exige EXACTAMENTE 1 archivo
   ↓
[Back] Devuelve { status: READY|FAILED|PARTIAL, file, logs[] }
   ↓
[Front] Renderiza los logs y el estado; si READY, habilita "Save Configuration"
```
> 1 intento, sin reintentos (acción manual → feedback inmediato).

### Save Configuration
```
[Front] Pulsa "Save Configuration"
   ↓
[Front] credential-crypto.js cifra la contraseña con AES-GCM (enc:v1:aes-gcm:...)
   ↓
[Front] POST /api/config/save { connection: {...} }
   ↓
[Back] Merge con la config existente → escribe config/app-config.json
   ↓
[Front] Muestra "SAVE: SAVED"
```

### Comportamiento según autenticación
- **Auth desmarcado:** el acceso usa la **identidad de Windows del proceso** (no anónimo). En un recurso protegido del cliente → deniega ("la carpeta requiere credenciales").
- **Auth marcado:** se conecta con usuario/contraseña (y dominio si aplica).

---

## Tab 2 — Parser

**Objetivo:** definir cómo leer el CSV (delimitador, header, columnas) y previsualizar.

### Check Configuration
```
[Front] El usuario define delimitador, Has Header, comillas y añade columnas
        (nombre + índice + tipo). Pulsa "Check Configuration"
   ↓
[Front] parser-ui.js recoge la config y, vía csv-parser.js, valida contra el
        contenido del archivo (lo obtiene del backend):
        - parsea cabeceras o autogenera nombres (Column0, Column1, … por POSICIÓN)
        - valida que los índices existen
        - comprueba consistencia de columnas por fila
        - genera el preview (array posicional)
   ↓
[Front] showPreview pinta las filas leyendo cada celda por el COLUMN INDEX
        configurado (igual que producción) → respeta el orden que definiste
   ↓
[Front] Si todo OK, habilita "Save Configuration"
```
> Has Header = No → los nombres son automáticos y consecutivos (Column0…); el índice solo selecciona qué columna del archivo se lee.

### Save Configuration
```
[Front] Pulsa "Save" → POST /api/config/save { parser: { delimiter, hasHeader, columns[...] } }
   ↓
[Back] Merge → app-config.json ; [Front] etiqueta "STATUS: SAVED"
   ↓
[Front] Auto-rellena la pestaña Mapping con las columnas guardadas
```

---

## Tab 3 — Mapping

**Objetivo:** asignar a cada columna su nombre de salida (JSON tag) y elegir la columna de búsqueda.

```
[Front] Al entrar, loadFromParser() → GET /api/config/load
   ↓
[Front] Pinta una fila por columna del Parser (CSV Column → JSON Tag)
        y rellena el selector "Search Column" con esas columnas
   ↓
[Front] El usuario escribe los JSON tags y elige la columna de búsqueda
        (la que contiene el código que enviará producción)
   ↓
[Front] Pulsa "Save Mapping":
        - valida que cada fila tenga tag y que se haya elegido Search Column
        - POST /api/config/save { mapping: [{csvColumn, index, jsonTag, include:true}],
                                   searchColumnIndex }
   ↓
[Back] Merge → app-config.json ; [Front] "MAPPING: SAVED"
```
> En CSV todas las columnas del Parser se exponen (no hay checkbox Include). `searchColumnIndex` se guarda una vez aquí → producción solo envía `productCode`.

---

## Tab 4 — Validation

**Objetivo:** marcar qué campos son obligatorios.

```
[Front] Al entrar, loadFromMapping() → GET /api/config/load
   ↓
[Front] Pinta una fila por campo mapeado (CSV Column | JSON Tag | Required)
        y restaura los "required" ya guardados
   ↓
[Front] El usuario marca los campos obligatorios y pulsa "Save"
   ↓
[Front] POST /api/config/save { validation: [{csvColumn, jsonTag, required}] }
   ↓
[Back] Merge → app-config.json ; [Front] "VALIDATION: SAVED"
```
> En la importación, si un campo `required` viene vacío → `VALIDATION_FAILED`.

---

## Tab 5 — Persistence

**Objetivo:** definir el modo de operación y ver el historial.

```
[Front] El usuario elige Trigger Mode (Auto / Manual)
        - si Manual → aparece "Validation Level" (Superior / Mismo nivel)
   ↓
[Front] Pulsa "Save" → POST /api/config/save
        { persistence: { triggerMode, validationLevel? } }
   ↓
[Back] Merge → app-config.json ; [Front] "PERSISTENCE: SAVED"

[Front] El Sync Log se carga con GET /api/sync-log (tabla paginada)
        y muestra cada importación con sus valores y el operador
```

---

## Flujo de Importación (producción)

**Endpoint:** `POST /api/product/import` — lo llama la app de producción.

```
[Producción] POST /api/product/import { productCode, requestedBy, confirmed?, confirmedBy? }
   ↓
[Back] loadProductionContext():
        1. Lee y valida app-config.json
        2. Descifra la contraseña SMB
        3. Detecta el archivo por patrón (soporta nombres dinámicos)
        4. Lee el archivo y parsea las filas
        → REINTENTOS: 3 intentos, 10 s entre cada uno (solo acceso SMB)
   ↓
[Back] Resuelve la columna de búsqueda (request override → config.searchColumnIndex)
   ↓
[Back] Busca el productCode en esa columna (en memoria)
        │
        ├─ No existe → log NOT_FOUND → responde { status: NOT_FOUND }
        │
        └─ Existe → aplica el mapping (jsonTag) → valida campos requeridos
              │
              ├─ Falta un requerido → log VALIDATION_FAILED → { status: VALIDATION_FAILED, message }
              │
              ├─ Modo MANUAL y confirmed=false → { status: CONFIRMATION_REQUIRED,
              │        validationLevel, preview }   (NO se registra en log)
              │        → producción muestra login supervisor (superior) o botón (same)
              │        → reenvía con confirmed=true + confirmedBy
              │
              └─ Auto, o Manual confirmado →
                    upsertProduct() [caché]  +  insertSyncLog(FOUND, fields, requestedBy, confirmedBy)
                    → responde { status: IMPORTED, product }
```

### Qué se registra en el log (`data/sync-log.json`, append-only)
```
{ timestamp, productCode, result, requestedBy, confirmedBy, fields, error }
```
- `result`: FOUND | NOT_FOUND | VALIDATION_FAILED | ERROR
- `fields`: valores de cada columna configurada (null si no hay producto)
- `CONFIRMATION_REQUIRED` no se registra (aún no es una acción completada)

El mismo log se ve en **Persistence → Sync Log** y en la vista mock de producción.

---

## Resumen de endpoints por paso

| Paso | Endpoint |
|------|----------|
| Connector — test | `POST /test-connection` |
| Cualquier "Save" del wizard | `POST /api/config/save` |
| Cualquier carga de pestaña | `GET /api/config/load` |
| Producción — importar | `POST /api/product/import` |
| Producción — columna de búsqueda | `GET /api/product/search-column` |
| Historial / log | `GET /api/sync-log` |
