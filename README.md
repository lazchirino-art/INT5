# INT5 — CSV Integration Module

Módulo embebido Node.js + Express para máquinas de empaque de medicamentos. Cuando el software de empaque (CORINA) no encuentra un producto en su base de datos interna, consulta a INT5, que lo busca en un archivo CSV ubicado en una ruta de red SMB.

## Arquitectura

```
CORINA (software empaque)
        │
        │ HTTP POST /api/product/import
        ▼
  INT5 (Node.js + Express, puerto 3000)
        │
        ├── Lee app-config.json  (conexión, parser, mapping, validación, persistencia)
        ├── PowerShell → SMB → CSV en red local
        ├── Parsea y busca el producto
        ├── Aplica mapping de columnas → JSON tags
        ├── Valida campos requeridos
        └── Guarda log en data/sync-log.json
```

## Estructura del Proyecto

```
INT5/
├── server.js                          ← Servidor principal (npm start)
├── package.json
├── backend/
│   ├── network-path-handler-windows.js  ← Acceso SMB vía PowerShell
│   ├── credential-crypto.js             ← Cifrado AES-GCM (lado servidor)
│   ├── csv-utils.js                     ← Utilidades de parseo CSV
│   └── local-db.js                      ← Storage JSON (sync-log + cache productos)
├── config/
│   ├── app-config.json                  ← Configuración persistida (auto-generado)
│   └── .env                             ← ENCRYPTION_SECRET
├── data/
│   ├── sync-log.json                    ← Log de importaciones (auto-generado)
│   └── products.json                    ← Caché de productos (auto-generado)
├── src/
│   ├── pages/
│   │   ├── index.html                   ← Menú principal
│   │   └── csv-integration.html         ← Wizard de configuración (5 tabs)
│   ├── js/
│   │   ├── csv-integration.js           ← Lógica principal del wizard
│   │   ├── credential-crypto.js         ← Cifrado AES-GCM (lado cliente)
│   │   ├── config-loader.js             ← Carga configuración al abrir la página
│   │   ├── network-path-client.js       ← Cliente HTTP para el backend
│   │   ├── csv-parser.js                ← Parseo CSV en frontend
│   │   ├── parser-ui.js                 ← UI del tab Parser
│   │   ├── mapping-ui.js                ← UI del tab Mapping
│   │   ├── validation-ui.js             ← UI del tab Validation
│   │   └── persistence-ui.js            ← UI del tab Persistence + Sync Log
│   └── styles/
│       ├── csv-integration.css
│       └── main.css
└── docs/
    ├── API-ENDPOINT.md                  ← Referencia completa de la API
    ├── BACKEND-SMB.md                   ← Documentación técnica del backend SMB
    └── SMB-FILE-DETECTOR.md             ← Módulo de detección de archivos
```

## Wizard de Configuración (5 tabs)

| Tab | Nombre | Descripción |
|-----|--------|-------------|
| 1 | **Connector** | Ruta SMB, patrón de archivo, credenciales |
| 2 | **Parser** | Delimitador, columnas esperadas, preview |
| 3 | **Mapping** | Renombrar columnas CSV → JSON tags de salida |
| 4 | **Validation** | Marcar campos como Required u Optional |
| 5 | **Persistence** | Modo Auto/Manual + Sync Log de importaciones |

## Acceso Local

| URL | Desde |
|-----|-------|
| `http://localhost:3000` | PC (localhost) |
| `http://int5:3000` | PC (hosts file) |
| `http://int5.local:3000` | Teléfono en la misma red (mDNS) |
| `http://192.168.x.x:3000` | Cualquier dispositivo en la red |

## Iniciar

```powershell
npm start
```

## Dependencias

| Paquete | Uso |
|---------|-----|
| `express` | Servidor HTTP |
| `cors` | Cabeceras CORS |
| `dotenv` | Variables de entorno |
| `smb2` | Conexión SMB (no usado directamente — PowerShell es el canal real) |
| `bonjour-service` | mDNS para `int5.local` |

## Seguridad

- Las contraseñas se cifran con **AES-GCM** antes de guardarse en `app-config.json`
- La clave de cifrado está en `backend/.env` (`ENCRYPTION_SECRET`) — nunca se sube al repositorio
- En el frontend, el cifrado usa `window.CSV_INT_LOCAL_SECRET` (definido en `csv-integration.html`)
- Los logs nunca incluyen contraseñas en claro

## Licencia

Proyecto interno — Todos los derechos reservados
