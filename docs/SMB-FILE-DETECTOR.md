# SMB File Detector — Documentación Técnica

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Novedad reciente: las entradas de tipo carpeta (`<DIR>`, incluyendo `.`/`..`) ya no se cuentan como archivos en la detección.

## Descripción General

El acceso SMB en INT5 se implementa en **`backend/network-path-handler-windows.js`** mediante la clase `NetworkPathHandlerWindows`. Usa **PowerShell** como capa de transporte para acceder a rutas de red, en lugar de la librería `smb2` directamente.

Este enfoque garantiza compatibilidad nativa con Windows sin problemas de dependencias binarias.

## Arquitectura

```
NetworkPathHandlerWindows
        │
        ├── detect()     → PowerShell Get-ChildItem → lista archivos → aplica patrón
        └── readFile()   → PowerShell Get-Content   → devuelve string UTF-8
```

## Clase: `NetworkPathHandlerWindows`

### Constructor

```js
import NetworkPathHandlerWindows from './backend/network-path-handler-windows.js';
import CredentialCrypto from './backend/credential-crypto.js';

const credentialCrypto = new CredentialCrypto(process.env.ENCRYPTION_SECRET);
const handler = new NetworkPathHandlerWindows(credentialCrypto);
```

El parámetro `credentialCrypto` es opcional. Si se pasa, el handler puede descifrar contraseñas cifradas con AES-GCM antes de usarlas.

---

### `detect(params)` — Detectar archivo

Accede a la carpeta SMB, lista los archivos y selecciona el que coincide con el patrón.

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `path` | string | Sí | Ruta UNC: `\\servidor\compartida\carpeta` |
| `pattern` | string | Sí | Patrón de archivo: `medications_*.csv` |
| `username` | string | No | Usuario SMB (null si no requiere auth) |
| `password` | string | No | Contraseña (en claro o cifrada `enc:v1:...`) |
| `domain` | string | No | Dominio Windows (null si no aplica) |

**Retorna:**

```js
{
  status: 'READY' | 'FAILED',
  file:   string | null,         // nombre del archivo seleccionado
  logs:   string[]               // log de pasos (para mostrar en el wizard)
}
```

**Ejemplo:**

```js
const result = await handler.detect({
  path:     '\\\\192.168.0.10\\medicinas',
  username: 'operador',
  password: 'pass123',
  domain:   null,
  pattern:  'medications_*.csv'
});

if (result.status === 'READY') {
  console.log('Archivo:', result.file); // 'medications_20260602.csv'
}
```

---

### `readFile(params)` — Leer contenido del archivo

Lee el contenido completo del archivo como string UTF-8.

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `path` | string | Sí | Ruta UNC de la carpeta |
| `filename` | string | Sí | Nombre exacto del archivo (resultado de `detect`) |
| `username` | string | No | Usuario SMB |
| `password` | string | No | Contraseña (en claro) |
| `domain` | string | No | Dominio Windows |

**Retorna:** `string` con el contenido CSV, o `null` si falló.

**Ejemplo:**

```js
const content = await handler.readFile({
  path:     '\\\\192.168.0.10\\medicinas',
  filename: 'medications_20260602.csv',
  username: 'operador',
  password: 'pass123',
  domain:   null
});

// content = "MedCode,MedName,Dose\nASP001,Aspirina 100mg,100mg\n..."
```

---

## Patrones soportados

El módulo convierte el patrón a una expresión regular internamente.

| Patrón | Coincide con |
|--------|-------------|
| `*.csv` | Cualquier archivo `.csv` |
| `medications_*.csv` | `medications_20260602.csv`, `medications_20260603.csv` |
| `report_2026*.csv` | `report_20260101.csv`, `report_20260601.csv` |
| `data.csv` | Solo `data.csv` (coincidencia exacta) |

Regla: si coinciden **0 archivos** → `FAILED`. Si coinciden **2 o más** → `FAILED` (usar patrón más específico).

---

## Flujo de validación

```
1. Validar que path y pattern están definidos
2. Validar formato UNC (debe comenzar con \\)
3. Ejecutar PowerShell: Get-ChildItem en la ruta con credenciales
4. Filtrar archivos por patrón
5. Si 0 coincidencias → FAILED "No files found"
6. Si 2+ coincidencias → FAILED "Multiple files found"
7. Si 1 coincidencia → READY, file = nombre del archivo
```

---

## Autenticación

### Sin dominio

```js
{ username: 'usuario', password: 'contraseña', domain: null }
// PowerShell usa: -Credential usuario
```

### Con dominio

```js
{ username: 'usuario', password: 'contraseña', domain: 'EMPRESA' }
// PowerShell usa: -Credential EMPRESA\usuario
```

### Sin credenciales

```js
{ username: null, password: null, domain: null }
// PowerShell accede sin -Credential (sesión Windows actual)
```

---

## Contraseñas cifradas

Si `credentialCrypto` se pasó al constructor, el handler detecta automáticamente si la contraseña está cifrada (formato `enc:v1:aes-gcm:...`) y la descifra antes de usarla.

Si la descifra con error, usa el valor original. Esto permite degradación segura cuando el `ENCRYPTION_SECRET` cambia.

---

## Logs generados

Los logs son arrays de strings planos retornados en `result.logs`. Se muestran en el panel de Connection Test del wizard.

Ejemplos de mensajes:
```
✓ Folder accessible
✓ Files found: 3
✓ Matching files: 1
✓ File selected: medications_20260602.csv
✗ Access is denied
✗ Cannot find network path
⚠ No files found matching pattern
```

---

## Limitaciones

- Solo funciona en **Windows** (usa PowerShell)
- Solo acceso a **una carpeta** — no recursivo
- Solo un archivo por operación (un detect → un readFile)
- Sin reintentos automáticos
- Sin caché de conexiones (cada llamada abre y cierra la sesión PowerShell)

---

## Uso en server.js

El handler se instancia dentro de `loadProductionContext()` para todos los endpoints de producto, y en el endpoint `POST /test-connection` para el wizard.

```js
import NetworkPathHandlerWindows from './backend/network-path-handler-windows.js';
import CredentialCrypto from './backend/credential-crypto.js';

// En loadProductionContext():
const credentialCrypto = process.env.ENCRYPTION_SECRET
  ? new CredentialCrypto(process.env.ENCRYPTION_SECRET)
  : null;

const handler = new NetworkPathHandlerWindows(credentialCrypto);

const fileContent = await handler.readFile({
  path:     connectorConfig.path,
  filename: connectorConfig.filename,
  username: connectorConfig.username || null,
  password: password,   // ya descifrado
  domain:   connectorConfig.domain || null
});
```
