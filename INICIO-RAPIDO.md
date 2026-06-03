# Inicio Rápido — INT5

## Requisitos

- Windows 10/11
- Node.js 18+
- Acceso a la ruta SMB en la red local

## Iniciar el servidor

```powershell
cd INT5
npm install   # solo la primera vez
npm start
```

Salida esperada:

```
==================================================
Backend Server
==================================================

✔ Server running on port 3000
✔ Local:   http://localhost:3000
✔ mDNS:    http://int5.local:3000  ← PC y teléfono (misma red)
✔ Network: http://192.168.x.x:3000  [Wi-Fi]
...
==================================================
```

## Abrir la aplicación

Abre el navegador en: `http://localhost:3000`  
O desde el teléfono (misma red): `http://int5.local:3000`

---

## Configuración del wizard (5 tabs)

### Tab 1 — Connector

1. Selecciona **Network Path**
2. Ingresa la ruta SMB: `\\servidor\compartida\carpeta`
3. Ingresa el patrón de archivo: `medications_*.csv`
4. Si la carpeta requiere credenciales, marca **Authentication**
5. Haz click en **Test Connection**
6. Si el resultado es **STATUS: READY**, haz click en **Save Configuration**

### Tab 2 — Parser

1. Configura el delimitador (`,` por defecto)
2. Indica si el archivo tiene encabezado
3. Agrega las columnas esperadas con su nombre e índice
4. Haz click en **Check Configuration** para ver un preview del CSV
5. Haz click en **Save Configuration**

### Tab 3 — Mapping

1. La tabla se llena automáticamente con las columnas del parser
2. Edita el **JSON Tag** de cada columna (nombre que usará la API de salida)
3. Desmarca **Include** para excluir columnas del response
4. Haz click en **Save Mapping**

### Tab 4 — Validation

1. La tabla se llena desde el mapping guardado
2. Marca **Required** en los campos obligatorios
3. Si un campo requerido está vacío en el CSV, el producto se rechaza con el mensaje:  
   `"Product found in CSV but with incomplete data — field [X] is empty"`
4. Haz click en **Save Validation Rules**

### Tab 5 — Persistence

1. Elige el **Trigger Mode**:
   - **Auto** — busca, valida e importa silenciosamente en cada llamada
   - **Manual** — devuelve `CONFIRMATION_REQUIRED` primero; importa al reenviar con `confirmed: true`
2. Haz click en **Save Persistence Config**
3. El **Sync Log** muestra cada llamada a `/api/product/import` con timestamp, resultado y errores

---

## Llamada desde CORINA (endpoint principal)

```http
POST http://int5:3000/api/product/import
Content-Type: application/json

{
  "productCode": "ASP001",
  "searchColumnIndex": 0
}
```

Respuestas posibles:

| `status` | Descripción |
|----------|-------------|
| `IMPORTED` | Producto encontrado, validado e importado |
| `NOT_FOUND` | No existe en el CSV |
| `VALIDATION_FAILED` | Campo requerido vacío — incluye `message` con detalle |
| `CONFIRMATION_REQUIRED` | Modo manual — reenviar con `"confirmed": true` |
| `ERROR` | Error de configuración o conexión |

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `Cannot GET /` | Servidor no está corriendo | `npm start` |
| `STATUS: FAILED` en Test Connection | Ruta o credenciales incorrectas | Verifica en File Explorer primero |
| Config no carga al abrir la página | `ENCRYPTION_SECRET` cambió | Vuelve a ingresar la contraseña en Tab 1 y guarda |
| `Parser not configured` en endpoint | Tab 2 no guardado | Completa y guarda el Parser |
| Puerto 3000 ocupado | Otra instancia corriendo | `taskkill /F /IM node.exe` en CMD |

---

## Estructura de archivos relevantes

```
INT5/
├── server.js               ← Punto de entrada
├── backend/.env            ← ENCRYPTION_SECRET (no subir al repo)
├── config/app-config.json  ← Configuración guardada (auto-generado)
├── data/sync-log.json      ← Log de importaciones (auto-generado)
└── data/products.json      ← Caché de productos (auto-generado)
```

Ver `docs/API-ENDPOINT.md` para la referencia completa de la API.
