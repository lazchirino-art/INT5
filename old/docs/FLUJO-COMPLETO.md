# Flujo Completo - POC SMB Network Path

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Novedades recientes: el log guarda los valores de las columnas y el operador (`requestedBy`/`confirmedBy`); nivel de validación manual (`validationLevel`); el checkbox *Include* solo existe en API-RESP (no en CSV); despliegue en kiosco con arranque automático.

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│         Windows Machine (Local)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Browser (http://localhost:3000)             │  │
│  │  ├─ index.html (Menú principal)              │  │
│  │  └─ csv-integration.html (Formulario)│  │
│  │     ├─ network-path-client.js (HTTP)         │  │
│  │     ├─ credential-crypto.js (Encriptación)   │  │
│  │     ├─ config-loader.js (Cargar config)      │  │
│  │     └─ csv-integration.js (Lógica)│  │
│  └──────────────────────────────────────────────┘  │
│            ↓ POST /test-connection                 │
│  ┌──────────────────────────────────────────────┐  │
│  │  Node.js + Express (server.js)               │  │
│  │  ├─ /test-connection (endpoint)              │  │
│  │  └─ network-path-handler-windows.js          │  │
│  │     └─ PowerShell (acceso SMB)               │  │
│  └──────────────────────────────────────────────┘  │
│            ↓ Get-ChildItem                        │
│  ┌──────────────────────────────────────────────┐  │
│  │  SMB Network Share                           │  │
│  │  \\servidor\compartida\carpeta               │  │
│  │  └─ medications_20260502.csv                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Flujo de Uso

### 1. Iniciar Aplicación

```bash
cd INT5
npm install
npm start
```

Servidor inicia en `http://localhost:3000`

### 2. Acceder al Formulario

1. Abrir navegador: `http://localhost:3000`
2. Click en botón "CSV" (en sección "Integraciones")
3. Se abre `csv-integration.html`
4. Tab "1. Connector" (Network Path)

### 3. Ingresar Datos

**Campos requeridos:**
- **Path**: `\\servidor\compartida\carpeta`
- **File Name Pattern**: `*.csv` o `medications_*.csv`

**Campos opcionales:**
- **Authentication**: Marcar si necesita usuario/contraseña
  - Username: `usuario`
  - Password: `contraseña`
- **Use Domain**: Marcar si necesita dominio
  - Domain: `DOMINIO`

### 4. Probar Conexión

Click en botón "Test Connection"

**Flujo interno:**
```
Frontend valida entrada
    ↓
NetworkPathClient prepara credenciales
    ↓
Envía POST a /test-connection
    ↓
Backend valida ruta UNC
    ↓
PowerShell ejecuta Get-ChildItem
    ↓
Accede a ruta SMB (con credenciales si existen)
    ↓
Lista archivos
    ↓
Aplica patrón (regex)
    ↓
Valida exactamente 1 archivo
    ↓
Devuelve logs detallados + status
    ↓
Frontend renderiza resultado en UI
```

### 5. Resultado

**Status READY** (éxito):
- ✓ Ruta resuelta
- ✓ Conectado a compartida
- ✓ Autenticado (si aplica)
- ✓ Carpeta accesible
- ✓ Exactamente 1 archivo encontrado

**Status FAILED** (error):
- ✗ Ruta no encontrada
- ✗ Acceso denegado
- ✗ Autenticación fallida
- ✗ Ningún archivo encontrado

**Status PARTIAL** (advertencia):
- ⚠ Múltiples archivos encontrados
- ⚠ Patrón no coincide

### 6. Guardar Configuración

Si status es **READY**:
- Click en botón "Save Configuration"
- Credenciales se encriptan con clave del navegador
- Se guardan en localStorage

### 7. Cargar Configuración Guardada

Próxima vez que abras la página:
- ConfigLoader detecta configuración guardada
- Carga automáticamente los datos
- Campos se rellenan
- Puedes hacer click directo en "Test Connection"

## Encriptación

### Proceso de Almacenamiento

```javascript
// Entrada
{
  path: "\\servidor\compartida",
  username: "usuario",
  password: "secreto123"
}

// Encriptación
CredentialCrypto.prepareConnectionConfigForStorage(config)
  ├─ Genera clave desde navegador (SHA-256 de userAgent + screen)
  ├─ Encripta password con AES-GCM
  ├─ Guarda en localStorage
  └─ Clave se regenera cada sesión (estable por navegador)

// Almacenado
{
  path: "\\servidor\compartida",
  username: "enc:v1:aes-gcm:...",
  password: "enc:v1:aes-gcm:..."
}
```

### Seguridad

- ✓ Contraseñas encriptadas en localStorage
- ✓ Clave derivada de navegador (no hardcodeada)
- ✓ AES-GCM con IV aleatorio
- ✓ No se envían credenciales sin encriptar al servidor
- ⚠ localStorage sigue siendo vulnerable a XSS (usar HTTPS en producción)

## Logs

### Logs del Cliente

```javascript
[2026-05-02T12:00:00.000Z] Iniciando conexión...
[2026-05-02T12:00:00.001Z] Ruta: \\servidor\compartida
[2026-05-02T12:00:00.002Z] Patrón: *.csv
[2026-05-02T12:00:00.003Z] Enviando solicitud al backend...
[2026-05-02T12:00:00.050Z] Respuesta recibida: READY
```

### Logs del Servidor (PowerShell)

```
[LOG] Resolving path...
[LOG] Connecting to network share...
[LOG] Accessing folder via PowerShell...
[LOG] Folder accessible
[LOG] Files found: 3
[LOG] Matching files: 1
[LOG] File selected: medications_20260502.csv
```

### Logs Combinados en UI

```
✓ Iniciando conexión...
✓ Ruta: \\servidor\compartida
✓ Patrón: *.csv
✓ Enviando solicitud al backend...
✓ Resolving path...
✓ Connecting to network share...
✓ Accessing folder via PowerShell...
✓ Folder accessible
✓ Files found: 3
✓ Matching files: 1
✓ File selected: medications_20260502.csv

STATUS: READY
```

## Troubleshooting

### Error: "Cannot find path"
- Verificar ruta UNC: `\\servidor\compartida\carpeta`
- Verificar que el servidor SMB esté accesible
- Probar con `net use` en PowerShell

### Error: "Access is denied"
- Verificar credenciales (usuario/contraseña)
- Verificar permisos en la carpeta compartida
- Verificar que el dominio sea correcto (si aplica)

### Error: "Multiple files found"
- Ajustar patrón para ser más específico
- Ejemplo: `medications_*.csv` → `medications_202605*.csv`

### Error: "No files found"
- Verificar que el patrón coincida con archivos reales
- Verificar que haya archivos en la carpeta
- Usar patrón más genérico: `*` o `*.csv`

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `server.js` | Express + endpoint `/test-connection` |
| `backend/network-path-handler-windows.js` | Lógica SMB con PowerShell |
| `src/js/network-path-client.js` | Cliente HTTP para frontend |
| `src/js/credential-crypto.js` | Encriptación AES-GCM |
| `src/js/config-loader.js` | Cargar configuración guardada |
| `src/js/csv-integration.js` | Lógica del formulario |
| `src/pages/csv-integration.html` | UI del formulario |

## Próximos Pasos

1. **Parseo de CSV**: Leer archivo detectado y parsear contenido
2. **Validación de datos**: Validar estructura y tipos de datos
3. **Transformación**: Mapear columnas a esquema interno
4. **Persistencia**: Guardar datos en base de datos
5. **Automatización**: Ejecutar flujo periódicamente
