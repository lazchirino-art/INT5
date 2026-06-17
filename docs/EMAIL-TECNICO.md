# Email técnico — Entrega del módulo de integración INT5

> Borrador listo para enviar al equipo técnico interno. Ajusta destinatarios/nombres antes de mandarlo.

---

**Asunto:** INT5 — Módulo de integración de productos (CSV + API-REST) listo para revisión

**Para:** Equipo técnico
**De:** [tu nombre]

---

Hola equipo,

Os comparto el estado del módulo **INT5**, el componente que integra catálogos de productos de distintos clientes sin reprogramar: todo se configura por un asistente y queda guardado. El módulo **CSV está cerrado tras pruebas** y la integración **API-REST está implementada**. Abajo el resumen técnico.

## Qué es INT5

Un **servicio backend** (Node.js + Express, puerto 3000) que lee productos desde un **CSV en red (SMB)** o desde una **API REST externa**, los normaliza según una configuración guardada, y los expone por HTTP para que la app de producción los consuma. No es la UI del operador: es el "motor" detrás.

## Arquitectura (kiosco)

INT5 y la app de producción corren en **el mismo equipo** (kiosco). INT5 corre **oculto en segundo plano**; la app de producción muestra el wizard de INT5 (embebido vía `localhost:3000`) cuando hace falta y le pide datos por HTTP.

- **Configuración** (una vez): un técnico recorre el wizard de 5 pestañas y guarda en `config/app-config.json`.
- **Operación** (a diario): la app de producción llama a `POST /api/product/import`; INT5 busca, valida, devuelve y registra en el log.

## Componentes creados

- **Backend:** `server.js` (endpoints), `network-path-handler-windows.js` (SMB vía PowerShell), `credential-crypto.js` (AES-GCM), `csv-utils.js` (parseo/búsqueda), `local-db.js` (sync log + caché), `api-resp-handler.js` (cliente API-RESP).
- **Frontend (vanilla JS):** dos wizards de 5 pestañas — CSV (Connector, Parser, Mapping, Validation, Persistence) y API-RESP (Connector, Response Schema, Mapping, Validation, Persistence).
- **Utilidades:** `mock-api-server.js` (mock en :3001 para probar API-RESP), `start-int5.vbs` + `install-autostart.bat` (arranque automático en kiosco).

## Endpoints clave (contrato con producción)

- `POST /api/product/import` (CSV) y `POST /api/product/import-api` (API-RESP) — endpoints principales. Aceptan `requestedBy` y `confirmedBy` (la app de producción envía la identidad del operador; INT5 no gestiona usuarios).
- Estados de respuesta: `IMPORTED` / `NOT_FOUND` / `VALIDATION_FAILED` / `CONFIRMATION_REQUIRED` / `ERROR`.
- En modo **Manual**, la respuesta `CONFIRMATION_REQUIRED` incluye `validationLevel` (`"superior"` | `"same"`) para que producción muestre un login superior o un botón de auto-verificación.
- `GET /api/sync-log` — historial append-only. Cada entrada registra **los valores de cada columna** del producto + el operador (`requestedBy`/`confirmedBy`).

Contrato completo en `docs/API-ENDPOINT.md`.

## Decisiones de implementación importantes

- **Seguridad SMB por identidad de proceso:** con el authenticator desmarcado, INT5 accede con la identidad de Windows del proceso (no anónimo). En el kiosco el usuario es admin **local** pero ajeno al dominio del cliente, así que un recurso protegido del cliente deniega correctamente sin configuración extra. Para **probar** esto en desarrollo (donde hay SSO/admin) se ejecuta el servidor bajo una cuenta restringida `int5svc` — **solo herramienta de pruebas, no se usa en el kiosco**.
- **Cifrado de credenciales:** la contraseña SMB se guarda cifrada (AES-GCM) en `app-config.json`; el secreto vive en `backend/.env`.
- **Configuración por secciones:** cada pestaña guarda solo su sección (merge en backend) y se recarga sola al reentrar.

## Correcciones aplicadas durante las pruebas

- Detección de archivos: las carpetas (`<DIR>`, `.`/`..`) ya no se cuentan como archivos.
- Parser: el Has Header restaura "No" al cargar; nombres de columna consecutivos por posición; el preview respeta el Column Index; el Save actualiza la etiqueta de estado.
- Connector: `domain` aplicado igual en Test Connection y lectura real; mensaje claro "la carpeta requiere credenciales" con auth desmarcado.
- Mapping CSV: eliminado el checkbox Include redundante (se mantiene en API-RESP).
- Log: ahora guarda valores de columnas + operador (antes solo un contador).

## Documentación

- **Técnica (fuente de verdad):** `docs/INT5-DOCUMENTACION-TECNICA.md` (+ versión Word `.docx`).
- **Despliegue/seguridad:** `docs/DESPLIEGUE-KIOSCO.md`.
- **Contrato de API:** `docs/API-ENDPOINT.md`.

## Pendiente / a futuro

- El sync log no se purga (crece indefinidamente): valorar política de rotación.
- El connector no se re-testea al cargar: si se reconfigura, hay que probar/guardar conexión para habilitar el Check del Parser.

Repos y código en la rama `main`. Quedo atento a comentarios.

Saludos,
[tu nombre]
