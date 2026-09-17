# INT5 — Documentación Técnica

> Módulo de integración de productos para entornos de kiosco. Lee datos de
> productos desde un **CSV en red (SMB)** o desde una **API REST externa**, los
> normaliza según una configuración guardada, y los expone por HTTP para que la
> aplicación de producción los consuma.

Versión del documento: 2026-06-18 · Estado: módulo CSV cerrado tras testing.

---

## 1. Propósito

INT5 es un **servicio backend** (no es la aplicación que usa el operador). Resuelve el problema de integrar catálogos de productos de distintos clientes, cada uno con su propio formato de archivo o API, sin tener que reprogramar nada: todo se configura mediante un asistente (wizard) de 5 pasos y queda guardado.

Hay dos integraciones independientes, cada una con su wizard de 5 pestañas:

- **CSV** — lee un archivo CSV desde un recurso compartido de red (SMB).
- **API-RESP** — consume un endpoint REST externo que devuelve el producto en JSON.

---

## 2. Tecnologías utilizadas

| Capa | Tecnología |
|------|-----------|
| Runtime backend | Node.js (módulos ESM, `"type": "module"`) |
| Servidor HTTP | Express |
| Puerto | 3000 (configurable por `PORT`) |
| Acceso SMB | `net use` (vía `execFile`, sin shell) solo para autenticar; listado y lectura con `fs` de Node directamente sobre la ruta UNC. Requiere Windows |
| Cifrado de credenciales | AES-GCM (Web Crypto API / `crypto` de Node) |
| Descubrimiento en red | `bonjour-service` (mDNS — `int5.local`) |
| Frontend | HTML + CSS + JavaScript **vanilla** (sin frameworks) |
| Persistencia | Archivos JSON locales |
| API-RESP | `fetch` nativo de Node (v18+) |
| Dependencias npm | `express`, `cors`, `dotenv`, `bonjour-service` |

---

## 3. Arquitectura

INT5 y la aplicación de producción corren en **el mismo equipo** (un kiosco). La app de producción muestra la interfaz al operador; cuando hace falta, embebe el wizard de INT5 (vía `localhost:3000`) y le pide datos por HTTP.

```
┌──────────────────────── KIOSCO (un equipo) ────────────────────────┐
│                                                                      │
│   App de producción (pantalla completa, login de operador)           │
│     ├── botón "Integración"  ──►  abre  http://localhost:3000 (wizard)│
│     └── importar producto    ──►  POST  /api/product/import           │
│                                                                      │
│   INT5  (servicio en segundo plano, oculto, :3000)                   │
│     ├── sirve el wizard (config) y los endpoints (operación)          │
│     ├── lee el CSV en red (SMB)  ──►  \\servidor-cliente\share        │
│     └── o consume la API REST externa del cliente                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Dos momentos distintos

1. **Configuración (una vez, al instalar):** un técnico recorre el wizard de 5 pestañas y guarda. Se persiste en `config/app-config.json`.
2. **Operación (a diario):** la app de producción llama a `POST /api/product/import` cada vez que necesita un producto. INT5 busca, valida, devuelve y registra en el log.

Ver despliegue completo en **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)**.

---

## 4. Estructura de archivos

```
INT5/
├── server.js                       # Servidor Express + todos los endpoints
├── backend/
│   ├── network-path-handler-windows.js  # Acceso SMB: net use + fs sobre la ruta UNC (test + lectura)
│   ├── credential-crypto.js             # Descifrado AES-GCM de credenciales
│   ├── csv-utils.js                     # Parseo CSV + búsqueda + rowToObject
│   ├── local-db.js                      # Sync log + caché de productos (JSON files)
│   ├── api-resp-handler.js              # Cliente HTTP para API-RESP
│   └── .env                             # ENCRYPTION_SECRET y PORT
├── config/
│   └── app-config.json             # Configuración persistida (todas las secciones)
├── data/
│   ├── sync-log.json               # Log append-only de importaciones (se archiva al superar 5 MB)
│   └── products.json               # Caché de productos importados
├── src/
│   ├── pages/
│   │   ├── index.html              # Menú principal (botones CSV / API-RESP)
│   │   ├── csv-integration.html    # Wizard CSV (5 tabs)
│   │   └── api-resp-integration.html # Wizard API-RESP (5 tabs)
│   ├── js/                         # UI de cada tab (csv-* y api-resp-*)
│   └── styles/                     # CSS
├── mock-api-server.js              # Servidor mock (puerto 3001) para probar API-RESP
├── start-int5.vbs                  # Arranque oculto para el kiosco
├── install-autostart.bat           # Registra el arranque automático
└── uninstall-autostart.bat         # Quita el arranque automático
```

---

## 5. Flujo de configuración (wizard)

### CSV (csv-integration.html)

| Tab | Nombre | Qué configura |
|-----|--------|---------------|
| 1 | **Connector** | Ruta SMB, patrón de archivo, autenticación (usuario/contraseña/dominio). Test Connection verifica las credenciales y detecta el archivo. SFTP aparece deshabilitado (aún no disponible). |
| 2 | **Parser** | Delimitador, header (sí/no), comillas, escape, separador decimal, formato de fecha, valores vacíos y columnas esperadas (nombre + índice + tipo). Check Configuration (requiere el Connector guardado) valida y muestra preview; Save solo se habilita con resultado VALID. |
| 3 | **Mapping** | Asigna a cada columna del Parser un *JSON tag* (nombre de salida) y elige la **Search Column** (obligatoria). |
| 4 | **Validation** | Marca campos como **requeridos** (rechaza productos con ese campo vacío). |
| 5 | **Persistence** | Modo de trigger (auto/manual) y, en manual, el nivel de validación. Muestra el Sync Log. |

### API-RESP (api-resp-integration.html)

Misma estructura, adaptada a una API REST:

| Tab | Nombre | Diferencia respecto a CSV |
|-----|--------|---------------------------|
| 1 | **Connector** | URL base, path, método (GET/POST), autenticación (none / API Key / Bearer / Basic) |
| 2 | **Response Schema** | Se pega o se obtiene un JSON de ejemplo y se **auto-detectan** los campos |
| 3 | **Mapping** | Igual que CSV, pero **sí incluye** checkbox *Include* (porque el schema trae todos los campos) |
| 4 | **Validation** | Igual |
| 5 | **Persistence** | Igual |

### Carga automática

Toda la configuración se **guarda por sección** (cada tab guarda solo la suya) y se **recarga automáticamente** al volver a abrir cada pestaña. Una vez configurado todo, cada vez que se entra aparece lo guardado. Si se reconfigura desde el Connector/Parser hay que volver a guardar la cadena (Mapping/Validation), porque dependen de las columnas: Mapping y Validation muestran **"OUTDATED — ... SAVE AGAIN"** cuando las columnas del Parser o los tags del Mapping cambiaron después de guardarlos, o cuando la Search Column ya no existe. Editar cualquier campo del Connector anula su test/guardado; editar, añadir o quitar columnas del Parser anula el Check.

---

## 6. Endpoints

El contrato completo (request/response de cada endpoint) está en **[API-ENDPOINT.md](API-ENDPOINT.md)**. Resumen:

| Endpoint | Uso |
|----------|-----|
| `POST /api/config/save` | Guarda una sección de config (merge con el resto) |
| `GET /api/config/load` | Devuelve la config completa |
| `DELETE /api/config/clear` | Borra la config (con backup) |
| `POST /test-connection` | Prueba SMB y detecta el archivo (Tab 1 CSV) |
| `POST /api/product/import` | **Endpoint principal CSV** — busca, valida, importa, registra |
| `POST /api/product/import-api` | Endpoint principal **API-RESP** (timeout 10 s; solo un 404 de la API externa es `NOT_FOUND`, cualquier otro fallo es `ERROR` con HTTP 502) |
| `POST /api/apiResp/test-connection` | Prueba la API externa y detecta campos |
| `POST /api/connector/read-file` | Lee el CSV para el preview del Parser |
| `GET /api/product/search-column` | Devuelve la Search Column configurada (índice + nombre) |
| `GET /api/sync-log` | Historial de importaciones (paginado, append-only, filtro `?source=apiResp\|csv`) |
| `POST /api/product/search*`, `filter`, `GET /all`, `/stats` | Consultas directas al CSV — **[OPCIONAL]**, no usados por el flujo de producción actual |

---

## 7. Lógica de negocio

### Merge de configuración
Cada tab envía solo su sección a `/api/config/save`. El backend la mezcla con la existente (no pisa las demás). Secciones: `connection`, `parser`, `mapping`, `validation`, `persistence`, `searchColumnIndex`, `apiResp`. La escritura de `app-config.json` es atómica (archivo temporal + renombrado).

### `loadProductionContext()`
Helper compartido por todos los endpoints de producto CSV: valida la config (rechaza `connectorType` distinto de `networkPath`), descifra la contraseña SMB, **detecta el archivo por patrón en cada llamada** (soporta nombres dinámicos como `data_YYYYMMDD.csv`; no depende de un nombre guardado), lo lee y parsea las filas. Lanza error con `statusCode` si algo falta.

- Respeta `useAuthentication` y `useDomain` del Connector: si están desmarcados, no se usan usuario/contraseña ni dominio.
- Si la contraseña guardada no se puede descifrar (`ENCRYPTION_SECRET` ausente o distinto) responde **500** con un mensaje claro; nunca intenta usar el texto cifrado como contraseña.
- Reutiliza la sesión SMB existente y solo monta el recurso (`net use`) si el acceso falla. Los montajes se serializan. El contenido del archivo se cachea y solo se relee si cambian la fecha de modificación o el tamaño. Máximo 50 MB, timeout de lectura 30 s.
- Aplica los ajustes del Parser: `hasHeader` ("No" → la primera fila es un dato), *Decimal Separator* en columnas Number, *Date Format* en columnas Date (tokens `dd`, `MM`, `yyyy`, `yy` → `yyyy-MM-dd`; sin formato solo se convierte ISO; lo que no encaja queda como texto) y *Empty Value Representation* (lista separada por comas → esos valores pasan a `""`).

### Reintentos de acceso SMB
El acceso al archivo (detección + lectura) se reintenta **solo** ante fallos **transitorios** de red/conexión:

```
Intento 1 → falla → espera 10 s → Intento 2 → falla → espera 10 s → Intento 3 → falla → ERROR
```

- **3 intentos** en total, **10 segundos** entre cada uno (constantes `SMB_MAX_ATTEMPTS` y `SMB_RETRY_DELAY_MS` en `server.js`).
- Si cualquier intento tiene éxito, continúa de inmediato.
- **No se reintentan** (fallan al instante): contraseña incorrecta, cuenta bloqueada/restringida, acceso denegado, ningún archivo o varios archivos que coinciden con el patrón, archivo de más de 50 MB. Reintentar no lo arregla y, con credenciales malas, podría bloquear la cuenta.
- Código HTTP: **400** para esos errores de configuración, **502** para errores de red/servidor.
- **Solo se reintenta el acceso SMB.** El caso "producto no encontrado" (`NOT_FOUND`) se decide en memoria tras leer el archivo correctamente, así que **no** se reintenta y responde al instante.
- Implicación: si la red está caída, la llamada de importación puede tardar ~20–30 s en devolver el `ERROR` (2 esperas de 10 s + el tiempo de cada intento). La app de producción debe contemplar esa espera.

### Modos de trigger (Persistence)
- **Auto** — busca, valida e importa silenciosamente en cada llamada.
- **Manual** — la primera llamada devuelve `CONFIRMATION_REQUIRED` (sin log, sin caché); solo se importa cuando se reenvía con `confirmed: true`.

### Nivel de validación (solo modo Manual)
`persistence.validationLevel`:
- `"superior"` → la app de producción debe pedir login de un usuario/supervisor de nivel superior.
- `"same"` → basta un botón "verificado por el mismo operador".

Se devuelve en la respuesta `CONFIRMATION_REQUIRED` para que producción sepa qué UI mostrar sin leer la config completa.

### Validación de campos requeridos
Si un campo marcado como requerido viene vacío → se rechaza con `VALIDATION_FAILED` y el mensaje *"Product found in CSV but with incomplete data — field [X] is empty"*.

### Mapeo e índice de columna
El **Column Index** del Parser selecciona qué columna del archivo se lee; el **JSON tag** del Mapping es el nombre de salida. `rowToObject` (producción) lee `fila[col.index]` y guarda el valor bajo `col.name`/jsonTag. En CSV todas las columnas configuradas se exponen (no hay Include); en API-RESP el Include permite elegir entre los campos auto-detectados.

### Sync Log
Cada intento de importación se registra en `data/sync-log.json` (append-only, no se purga). Las escrituras son atómicas y un fallo al escribir el log nunca deja sin respuesta la petición. Si el JSON está corrupto se renombra a `sync-log.json.corrupt-<fecha>` (no se sobrescribe); al superar 5 MB se archiva como `data/sync-log.<fecha>.json` y se empieza uno nuevo. `GET /api/sync-log` admite `?source=apiResp` o `?source=csv`. Cada entrada incluye:

```json
{
  "id": "...", "timestamp": "...", "productCode": "ASP001",
  "result": "FOUND",
  "requestedBy": "operador.juan",
  "confirmedBy": "supervisor.ana",
  "fields": { "code": "ASP001", "name": "Aspirina 100mg" },
  "error": ""
}
```

- `result`: `FOUND` | `NOT_FOUND` | `VALIDATION_FAILED` | `ERROR`.
- `fields`: **valores de cada columna configurada** del producto (no un contador). `null` si no hay producto; parcial en `VALIDATION_FAILED`.
- `requestedBy` / `confirmedBy`: identidad del operador, **enviada por la app de producción** (INT5 no gestiona usuarios). Default `"unknown"` / `null`.
- El paso `CONFIRMATION_REQUIRED` **no se registra** (aún no es una acción completada).

---

## 8. Seguridad

### Cifrado de credenciales
La contraseña SMB se guarda **cifrada** en `app-config.json` con AES-GCM (formato `enc:v1:aes-gcm:...`). El secreto está en `backend/.env` (`ENCRYPTION_SECRET`) y en el frontend (`window.CSV_INT_LOCAL_SECRET`). Quien tenga acceso al `.env` puede descifrarla — es lo esperado en este diseño. `backend/.env` se carga relativo a la carpeta del proyecto (funciona desde cualquier directorio de trabajo); si falta `ENCRYPTION_SECRET`, el servidor muestra un error al arrancar. El secreto no se imprime en consola.

### Superficie HTTP
- La carpeta `config/` no se sirve por HTTP (`GET /config/app-config.json` → 404).
- `GET /:page` solo sirve archivos dentro de `src/pages` (sin path traversal).
- Rutas UNC validadas de forma estricta; `net use` se ejecuta sin shell, así que caracteres como `& | ^ %` en rutas, usuarios o contraseñas no inyectan comandos.
- Un body JSON inválido devuelve 400 `{"status":"FAILED","error":"Invalid JSON body"}`.

### Identidad de Windows y acceso SMB
Cuando el authenticator está **desmarcado**, INT5 accede al recurso con la **identidad de Windows del proceso** (el usuario bajo el que corre el servidor), **no de forma anónima**. Windows siempre presenta el token del usuario actual. Implicaciones:

- Si ese usuario ya tiene acceso (o el recurso es público) → entra.
- Si el recurso exige credenciales que ese usuario no tiene → **deniega** (la app muestra *"FOLDER REQUIRES CREDENTIALS"*).
- Si en esa sesión de Windows ya existe una conexión `net use` abierta con credenciales (p. ej. tras un Test Connection), Windows la reutiliza hasta cerrar sesión o reiniciar.

En el **kiosco** el usuario de Windows es admin **local** pero ajeno al dominio del cliente, así que sobre el recurso del cliente es un desconocido → sin credenciales, deniega. Por eso el comportamiento de seguridad funciona sin configuración extra. Ver detalle y la guía de pruebas (cuenta `int5svc`) en **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)**.

> `int5svc` es **solo una herramienta de pruebas en desarrollo** para simular el entorno restringido en una máquina que tiene SSO/admin. No se usa en el kiosco.

---

## 9. Persistencia de datos

| Archivo | Contenido |
|---------|-----------|
| `config/app-config.json` | Configuración de los wizards (todas las secciones) |
| `data/sync-log.json` | Array append-only de entradas de log (más reciente primero al leer); archivado en `data/sync-log.<fecha>.json` al superar 5 MB |
| `data/products.json` | Caché `{ productCode: { ...datos, _updatedAt } }` |

---

## 10. Despliegue

Resumen (detalle en **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)**):

1. Copiar al kiosco la carpeta de INT5 (idealmente fuera de OneDrive, ej. `C:\INT5`) y el software de producción.
2. Ejecutar **`install-autostart.bat`** una vez (como administrador) → INT5 arranca oculto al iniciar sesión.
3. La app de producción abre `http://localhost:3000` para mostrar el wizard y llama a los endpoints enviando `requestedBy`/`confirmedBy`.

---

## 11. Limitaciones y notas conocidas

- El connector no se re-testea automáticamente al cargar: una conexión guardada aparece como **SAVE: SAVED** (suficiente para el Check del Parser), pero si se edita algún campo hay que volver a probar y guardar.
- El descifrado de credenciales depende del `ENCRYPTION_SECRET`; debe conservarse el mismo entre frontend y backend.
- El sync log no se purga: al superar 5 MB se archiva (`data/sync-log.<fecha>.json`) y los archivos archivados no se borran solos.
- Requiere Windows (usa `net use` y rutas UNC). SFTP aún no está disponible.
- Pruebas de seguridad en desarrollo: requieren ejecutar el servidor bajo una cuenta restringida (`int5svc`) para reproducir el comportamiento del kiosco.
