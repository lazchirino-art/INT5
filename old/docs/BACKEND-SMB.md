# Backend SMB — Documentación Técnica

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Novedades recientes: domain incluido también en Test Connection; mensaje claro "la carpeta requiere credenciales" cuando auth está desmarcado; modelo de seguridad por identidad del proceso explicado en la guía de despliegue.

## Descripción General

INT5 accede a archivos CSV en rutas de red compartidas (SMB/CIFS) usando **PowerShell** como intermediario, no la librería `smb2` directamente. Esto permite compatibilidad total con Windows sin dependencias nativas problemáticas.

**Flujo de acceso:**

```
server.js
    │
    └── NetworkPathHandlerWindows
              │
              └── PowerShell (New-PSDrive / Get-ChildItem / Get-Content)
                        │
                        └── SMB Share (\\servidor\compartida\carpeta)
```

## Archivo principal

**`backend/network-path-handler-windows.js`**

Clase `NetworkPathHandlerWindows` con dos métodos públicos:

### `detect(params)` — Detectar archivo

Busca el archivo que coincide con el patrón en la ruta SMB.

```js
const handler = new NetworkPathHandlerWindows(credentialCrypto);

const result = await handler.detect({
  path:     '\\\\servidor\\compartida\\carpeta',
  username: 'usuario',    // null si no requiere auth
  password: 'contraseña', // null si no requiere auth
  domain:   'DOMINIO',    // null si no aplica
  pattern:  'medications_*.csv'
});

// result:
// {
//   status: 'READY' | 'FAILED',
//   file:   'medications_20260602.csv' | null,
//   logs:   ['✓ Folder accessible', '✓ File selected: ...']
// }
```

### `readFile(params)` — Leer contenido del archivo

Lee el contenido completo del archivo como string UTF-8.

```js
const content = await handler.readFile({
  path:     '\\\\servidor\\compartida\\carpeta',
  filename: 'medications_20260602.csv',
  username: 'usuario',
  password: 'contraseña',
  domain:   'DOMINIO'
});

// content: string con el CSV completo
```

## Cifrado de credenciales

Las contraseñas se guardan cifradas en `config/app-config.json` usando AES-GCM.

**Servidor:** `backend/credential-crypto.js` — clase `CredentialCrypto`  
**Cliente:** `src/js/credential-crypto.js` — módulo IIFE expuesto en `window.CredentialCrypto`

La clave de cifrado del servidor se lee de `backend/.env`:
```
ENCRYPTION_SECRET=clave-aleatoria-segura
```

Formato del valor cifrado:
```
enc:v1:aes-gcm:<iv_base64>:<ciphertext_base64>
```

Al ejecutar el endpoint de Test Connection, la contraseña recibida puede ser:
- En claro (si el usuario la acaba de escribir)
- Cifrada (si viene del autoload de configuración)

El handler intenta descifrarla y si falla, usa el valor tal como llega.

## Estructura de app-config.json

```json
{
  "connection": {
    "connectorType":     "networkPath",
    "path":              "\\\\servidor\\compartida",
    "filename":          "medications_20260602.csv",
    "fileNamePattern":   "*.csv",
    "useAuthentication": true,
    "username":          "cliente",
    "password":          "enc:v1:aes-gcm:...",
    "useDomain":         false,
    "domain":            ""
  },
  "parser": {
    "delimiter":  ",",
    "hasHeader":  true,
    "quoteChar":  "\"",
    "escapeChar": "\"",
    "columns": [
      { "name": "MedCode", "index": 0, "type": "String" },
      { "name": "MedName", "index": 1, "type": "String" }
    ]
  },
  "mapping": [
    { "csvColumn": "MedCode", "index": 0, "jsonTag": "code", "include": true },
    { "csvColumn": "MedName", "index": 1, "jsonTag": "name", "include": true }
  ],
  "validation": [
    { "csvColumn": "MedCode", "jsonTag": "code", "required": true },
    { "csvColumn": "MedName", "jsonTag": "name", "required": false }
  ],
  "persistence": {
    "triggerMode": "auto"
  }
}
```

## loadProductionContext()

Función helper compartida por todos los endpoints de producto. Centraliza:

1. Verificar que `app-config.json` existe y es legible
2. Verificar que `connection.path` y `connection.filename` están definidos
3. Verificar que `parser.columns` tiene al menos una columna
4. Descifrar la contraseña SMB
5. Leer el archivo CSV desde la red
6. Parsear el CSV con `csvUtils.parseCSVContent()`

Devuelve: `{ config, connectorConfig, parserConfig, mappingConfig, rows }`

Lanza un `Error` con `.statusCode` en cualquier fallo (400 para config inválida, 500 para errores de servidor).

## Storage local

**`backend/local-db.js`** — módulo ES puro, sin dependencias externas.

| Función | Descripción |
|---------|-------------|
| `insertSyncLog(entry)` | Agrega una entrada al log de importaciones |
| `getSyncLog({page, limit})` | Lee el log paginado, más recientes primero |
| `upsertProduct({productCode, data})` | Guarda/actualiza un producto en caché |
| `getProduct(productCode)` | Lee un producto del caché |

Archivos:
- `data/sync-log.json` — array append-only, nunca se borra
- `data/products.json` — objeto `{productCode: {...datos}}` 

El directorio `data/` se crea automáticamente en la primera escritura.

## Patrones de archivo soportados

| Patrón | Coincide con |
|--------|-------------|
| `*.csv` | Cualquier `.csv` |
| `medications_*.csv` | `medications_20260602.csv` |
| `report.csv` | Solo `report.csv` (exacto) |

## Limitaciones

- Solo soporta **Network Path (SMB)**. SFTP está en el wizard como opción pero no implementado en el backend.
- No soporta búsqueda recursiva en subcarpetas.
- Solo un archivo por patrón — si coinciden varios, el resultado es `FAILED`.
- Acceso síncrono al archivo JSON (no apto para carga muy alta concurrente).

## Troubleshooting

### `Cannot find path` / `Access is denied`

- Verifica la ruta en File Explorer: `\\servidor\compartida`
- Verifica usuario y contraseña
- Si hay dominio, verifica que sea correcto

### `Password decryption failed`

- El `ENCRYPTION_SECRET` en `backend/.env` cambió respecto al que se usó al guardar
- Solución: vuelve a ingresar la contraseña en Tab 1 del wizard y guarda

### `ENCRYPTION_SECRET` no definido

- Crea `backend/.env` con `ENCRYPTION_SECRET=tu-clave`
- Sin esta variable el servidor arranca pero no cifra contraseñas

### El servidor encuentra el archivo en Test Connection pero falla al importar

- Verifica que el campo `filename` esté en `app-config.json`
- Si no está, haz Test Connection + Save en Tab 1 de nuevo
