# Guion de video — Demostración del módulo INT5 (CSV)

> Escenarios en orden, con qué hacer en pantalla, qué narrar y el resultado
> esperado. Pensado para grabar una demo clara del flujo y los casos de borde.

---

## Preparación (antes de grabar)

1. **Servidor principal:** arrancar INT5. Para demostrar el caso "acceso denegado" de forma realista en una PC de desarrollo, ejecutarlo bajo la cuenta restringida `int5svc`:
   ```
   runas /user:int5svc "cmd /k cd /d C:\ruta\INT5 && node server.js"
   ```
   (En el kiosco real esto no hace falta; ver DESPLIEGUE-KIOSCO.md.)
2. **Mock API (opcional, si se incluye API-RESP):** `iniciar-mock.bat` (puerto 3001).
3. Tener a mano un recurso SMB con un CSV de prueba y credenciales (`client` / `client123`).
4. Navegador en `http://localhost:3000`.

Duración estimada: 6–9 minutos.

---

## Parte 1 — Conexión (Tab 1: Connector)

| # | En pantalla | Narración | Resultado esperado |
|---|-------------|-----------|--------------------|
| 1 | Abrir el wizard CSV. Tab Connector. Seleccionar Network Path, poner ruta y patrón `*.csv`. **Authentication desmarcado.** Test Connection. | "Primero conectamos a la carpeta del cliente. Sin credenciales, sobre un recurso protegido…" | ❌ **"La carpeta requiere credenciales"** (acceso denegado) |
| 2 | Marcar **Authentication**, usuario `client`, contraseña `client123`. Test Connection. | "Ahora con las credenciales que da el cliente…" | ✅ **READY** — detecta el archivo (p. ej. `w.csv`) |
| 3 | (Opcional) Poner contraseña incorrecta. Test Connection. | "Si las credenciales no son válidas…" | ❌ **Authentication failed** |
| 4 | Volver a credenciales correctas. **Save Configuration.** | "Guardamos la conexión." | Etiqueta **SAVE: SAVED** (verde) |

> Punto clave a mencionar: el "acceso libre" solo ocurre si la carpeta es pública o el usuario del equipo ya tiene permiso; en un recurso protegido del cliente, sin credenciales, deniega.

---

## Parte 2 — Configuración (flujo feliz)

| # | En pantalla | Narración | Resultado esperado |
|---|-------------|-----------|--------------------|
| 5 | Tab **Parser**: elegir delimitador, Has Header, añadir columnas (nombre + índice + tipo). **Check Configuration.** | "Definimos cómo leer el archivo. El índice elige qué columna del CSV se lee." | Preview muestra los datos según el índice configurado |
| 6 | **Save Configuration** del Parser. | "Guardamos el parser." | Etiqueta **STATUS: SAVED** (verde) |
| 7 | Tab **Mapping**: a cada columna asignar su JSON tag. **Save Mapping.** | "Asignamos el nombre de salida de cada campo." | **MAPPING: SAVED** |
| 8 | Tab **Validation**: marcar como requeridos los campos críticos. **Save.** | "Marcamos qué campos son obligatorios." | **VALIDATION: SAVED** |
| 9 | Tab **Persistence**: elegir **Auto**. **Save.** | "Modo automático: importa sin confirmación." | **PERSISTENCE: SAVED** |
| 10 | Recargar la página y recorrer las pestañas. | "Todo lo guardado se recarga solo al reentrar." | Cada pestaña muestra lo guardado |

---

## Parte 3 — Importación (endpoints en producción)

> Simular las llamadas que haría la app de producción (vía Postman/cURL o la propia app). Mostrar también el **Sync Log** en el Tab Persistence tras cada caso.

| # | Caso | Llamada | Resultado esperado |
|---|------|---------|--------------------|
| 11 | Producto que **existe** | `POST /api/product/import` con un `productCode` válido, `requestedBy: "operador.demo"` | `IMPORTED` + entrada en el Sync Log con **los valores de las columnas** y el operador |
| 12 | Producto que **no existe** | mismo endpoint con un código inexistente | `NOT_FOUND` + entrada en el log |
| 13 | Campo requerido **vacío** | un producto al que le falte un campo marcado como requerido | `VALIDATION_FAILED` + mensaje "incomplete data — field [X]" + log |
| 14 | Modo **Manual** | en Persistence cambiar a **Manual** + nivel "superior" y guardar. Llamar al import. | 1ª respuesta `CONFIRMATION_REQUIRED` con `validationLevel: "superior"` (sin log). Reenviar con `confirmed: true` + `confirmedBy: "supervisor.demo"` → `IMPORTED` |

> En el paso 14, mencionar que `validationLevel` le dice a la app de producción si pedir login de supervisor ("superior") o solo un botón de auto-verificación ("same"), y que `requestedBy`/`confirmedBy` quedan registrados en el log.

---

## Parte 4 (opcional) — API-RESP con mock

| # | En pantalla | Resultado esperado |
|---|-------------|--------------------|
| 15 | Abrir la página de inicio del mock (`http://localhost:3001`) y mostrar los productos de prueba. | Lista de productos (ASP001, IBU200…) |
| 16 | Wizard API-RESP → Connector: Base URL `http://localhost:3001`, Path `/products/{productCode}`, GET. Test. | Detecta los campos del JSON |
| 17 | Response Schema → Fetch/Parse, elegir campos (Include). Mapping → tags. Import de `ASP001`. | `IMPORTED` con los campos elegidos |

---

## Cierre

- Mostrar el **Sync Log** completo: cada importación con su resultado, operador y valores.
- Resumir: configuración una vez → operación automática → todo queda auditado en el log.
- Mencionar que en el kiosco real INT5 arranca solo y oculto, y la app de producción embebe esta vista.
