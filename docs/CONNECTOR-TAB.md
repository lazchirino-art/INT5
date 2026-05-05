# Connector Tab - Documentación Completa

## 📋 Descripción General

La pestaña **Connector** es el primer paso en la configuración del CSV Parser. Su propósito es establecer y validar la conexión a una fuente de datos (ruta SMB o servidor SFTP) y detectar el archivo CSV que será procesado.

**Flujo principal:**
1. Seleccionar tipo de conexión (Network Path o SFTP)
2. Ingresar credenciales y parámetros de conexión
3. Probar la conexión (**Test Connection**)
4. Guardar la configuración (**Save Configuration**)

---

## 🎯 Funcionalidades Principales

### 1. Selección de Tipo de Conexión

**Opciones disponibles:**
- **Network Path (SMB)**: Acceso a carpetas compartidas en Windows (\\server\share)
- **SFTP**: Acceso remoto a servidores SFTP (SSH File Transfer Protocol)

Al cambiar el tipo de conexión, la interfaz muestra dinámicamente los campos correspondientes.

---

## 🔌 Network Path (SMB)

### Campos de Configuración

#### Path (Requerido)
- **Formato**: UNC (Universal Naming Convention)
- **Ejemplo**: `\\Laptop-fjiolk7l\new`
- **Descripción**: Ruta de la carpeta compartida en el servidor Windows
- **Validación**: Debe comenzar con `\\`

#### File Name Pattern (Requerido)
- **Ejemplo**: `medications_*.csv` o `*.csv`
- **Descripción**: Patrón de búsqueda para identificar el archivo CSV
- **Soporta wildcards**: `*` para coincidencias parciales
- **Casos de uso**:
  - `*.csv` - Cualquier archivo CSV
  - `medications_*.csv` - Archivos que comienzan con "medications_"
  - `data_YYYYMMDD.csv` - Archivos con fecha en el nombre

#### Authentication (Opcional)
- **Checkbox**: Habilitar/deshabilitar autenticación
- **Username**: Nombre de usuario para acceso a la carpeta
- **Password**: Contraseña del usuario
- **Nota**: Si la carpeta es pública, dejar sin marcar

#### Domain (Opcional)
- **Checkbox**: Habilitar/deshabilitar dominio
- **Domain**: Nombre del dominio (ej: COMPANY, DOMAIN)
- **Uso**: Necesario si el usuario pertenece a un dominio (formato: DOMAIN\username)

### Botones de Acción

#### Test Connection
- **Propósito**: Validar la conexión y detectar el archivo
- **Proceso**:
  1. Valida que Path y Pattern estén completos
  2. Intenta conectar al servidor SMB
  3. Autentica con las credenciales (si están habilitadas)
  4. Lista archivos en la carpeta
  5. Filtra por el patrón especificado
  6. Selecciona el archivo encontrado
- **Resultado**: Muestra logs detallados del proceso
- **Habilitación**: Se activa cuando Path y Pattern están completos

#### Save Configuration
- **Propósito**: Guardar la configuración en el backend
- **Proceso**:
  1. Encripta las credenciales (contraseña)
  2. Envía la configuración al backend
  3. Persiste en `config/app-config.json`
- **Habilitación**: Solo se activa después de una prueba de conexión exitosa (status: READY)
- **Encriptación**: Las contraseñas se encriptan usando AES-GCM antes de guardarse

### Connection Test Log

Muestra el resultado detallado de la prueba de conexión:

**Ejemplo de éxito (STATUS: READY):**
```
✓ Resolving path...
✓ Connecting to network share...
✓ Mounting share with credentials: client
✓ Folder accessible
✓ Files found: 5
✓ Pattern: *.csv
✓ Matching files: 1
✓ File selected: w.csv
```

**Ejemplo de fallo (STATUS: FAILED):**
```
✗ Resolving path...
✗ INVALID PATH FORMAT
  Expected UNC format: \\server\share\folder
  Your input: invalid_path
```

**Estados posibles:**
- **✓ SUCCESS**: Operación completada exitosamente
- **✗ FAILED**: Error en la operación
- **ℹ INFO**: Información adicional
- **⚠ WARNING**: Advertencia

### Save Status

Indica el estado de guardado de la configuración:
- **SAVE: NOT SAVED** - Configuración no guardada
- **SAVE: SAVING...** - Guardando en progreso
- **SAVE: SAVED** - Guardado exitosamente
- **SAVE: SAVE ERROR** - Error al guardar

---

## 🔐 Seguridad y Encriptación

### Flujo de Encriptación

1. **Frontend (Encriptación)**
   - Usuario ingresa contraseña en texto plano
   - Al hacer clic en "Test Connection", la contraseña se encripta
   - Se usa algoritmo: **AES-GCM** con clave derivada de `ENCRYPTION_SECRET`
   - Formato encriptado: `enc:v1:aes-gcm:iv_base64:encrypted_data_base64`

2. **Transmisión**
   - La contraseña encriptada se envía al backend via HTTP POST
   - El texto plano nunca se transmite por la red

3. **Backend (Desencriptación)**
   - El backend recibe la contraseña encriptada
   - Desencripta usando la misma `ENCRYPTION_SECRET`
   - Usa la contraseña desencriptada para acceder a SMB
   - La contraseña desencriptada se mantiene en memoria durante la operación

4. **Almacenamiento**
   - Las credenciales se guardan encriptadas en `config/app-config.json`
   - Al cargar la configuración, se desencriptan automáticamente

### Requisitos de Seguridad

- **ENCRYPTION_SECRET** debe ser idéntico en:
  - `backend/.env`: `ENCRYPTION_SECRET=...`
  - `src/pages/csv-integration.html`: `window.CSV_INT_LOCAL_SECRET = "..."`
  - `src/pages/index.html`: `window.CSV_INT_LOCAL_SECRET = "..."`

---

## 📱 SFTP (SSH File Transfer Protocol)

### Campos de Configuración

#### Host (Requerido)
- **Ejemplo**: `sftp.client.com` o `192.168.1.100`
- **Descripción**: Dirección del servidor SFTP

#### Port (Requerido)
- **Valor por defecto**: 22
- **Rango**: 1-65535
- **Descripción**: Puerto del servidor SFTP

#### Username (Requerido)
- **Ejemplo**: `john_doe`
- **Descripción**: Usuario para autenticación SFTP

#### Authentication Type (Requerido)
- **Opciones**:
  - **Password**: Autenticación por contraseña
  - **Private Key**: Autenticación por clave privada

#### Password (Condicional)
- **Requerido si**: Authentication Type = "Password"
- **Descripción**: Contraseña del usuario

#### Private Key (Condicional)
- **Requerido si**: Authentication Type = "Private Key"
- **Formato**: PEM (-----BEGIN PRIVATE KEY-----)
- **Descripción**: Clave privada SSH

#### Passphrase (Opcional)
- **Requerido si**: La clave privada está protegida por passphrase
- **Descripción**: Contraseña de la clave privada

#### Remote Path (Requerido)
- **Ejemplo**: `/incoming/files` o `/home/user/data`
- **Descripción**: Ruta en el servidor SFTP

#### File Name Pattern (Requerido)
- **Ejemplo**: `medications_*.csv`
- **Descripción**: Patrón de búsqueda (igual que Network Path)

---

## 🔄 Flujo de Operación Completo

### 1. Carga Inicial (Page Load)

```
1. Página se carga
2. JavaScript busca configuración guardada en backend
3. Si existe, desencripta y carga en los campos
4. Establece el tipo de conexión automáticamente
5. Habilita/deshabilita campos según la configuración
```

### 2. Test Connection (Network Path)

```
1. Usuario completa Path y Pattern
2. Opcionalmente ingresa credenciales
3. Hace clic en "Test Connection"

Frontend:
  → Valida campos requeridos
  → Encripta contraseña (si existe)
  → Envía POST /test-connection al backend

Backend:
  → Recibe credenciales encriptadas
  → Desencripta contraseña
  → Ejecuta PowerShell: net use + type
  → Retorna logs y archivo detectado

Frontend:
  → Recibe respuesta
  → Muestra logs en Connection Test Log
  → Actualiza Connection Status
  → Habilita "Save Configuration" si status = READY
```

### 3. Save Configuration

```
1. Usuario hace clic en "Save Configuration"

Frontend:
  → Encripta credenciales
  → Envía POST /api/config/save

Backend:
  → Recibe configuración encriptada
  → Guarda en config/app-config.json
  → Retorna confirmación

Frontend:
  → Muestra "SAVE: SAVED"
  → Configuración persiste para próximas sesiones
```

### 4. Próxima Sesión

```
1. Usuario abre la página nuevamente
2. Configuración se carga automáticamente
3. Campos se rellenan con valores guardados
4. Usuario puede:
   - Hacer Test Connection nuevamente
   - Pasar a la pestaña Parser
   - Modificar y guardar nueva configuración
```

---

## 🐛 Resolución de Problemas

### Error: "INVALID PATH FORMAT"
- **Causa**: Path no comienza con `\\`
- **Solución**: Usar formato UNC: `\\server\share\folder`

### Error: "SERVER NOT REACHABLE"
- **Causa**: Servidor SMB no está disponible
- **Soluciones**:
  - Verificar que el servidor esté encendido
  - Verificar conexión de red
  - Verificar que la ruta sea correcta
  - Probar ping al servidor: `ping server_name`

### Error: "ACCESS DENIED"
- **Causa**: Credenciales incorrectas o permisos insuficientes
- **Soluciones**:
  - Verificar username y password
  - Verificar que el usuario tenga permisos de lectura
  - Si usa dominio, verificar formato: `DOMAIN\username`

### Error: "FILE NOT FOUND"
- **Causa**: Ningún archivo coincide con el patrón
- **Soluciones**:
  - Verificar que el archivo existe en la carpeta
  - Verificar el patrón (ej: `*.csv` vs `medications_*.csv`)
  - Usar patrón más genérico para pruebas

### Error: "MULTIPLE FILES FOUND"
- **Causa**: Varios archivos coinciden con el patrón
- **Soluciones**:
  - Hacer el patrón más específico
  - Incluir fecha o versión en el patrón
  - Archivar archivos antiguos

### Error: "DECRYPTION FAILED"
- **Causa**: ENCRYPTION_SECRET no coincide entre frontend y backend
- **Solución**: Verificar que ambos tengan el mismo valor:
  ```bash
  # Backend
  cat backend/.env
  
  # Frontend
  grep CSV_INT_LOCAL_SECRET src/pages/csv-integration.html
  ```

---

## 📊 Datos Guardados

### Estructura de Configuración (Network Path)

```json
{
  "connection": {
    "connectorType": "networkPath",
    "type": "Network Path",
    "path": "\\\\Laptop-fjiolk7l\\new",
    "fileNamePattern": "*.csv",
    "useAuthentication": true,
    "username": "client",
    "password": "enc:v1:aes-gcm:...",
    "useDomain": false,
    "domain": ""
  }
}
```

### Ubicación de Almacenamiento

- **Backend**: `config/app-config.json`
- **Backup**: `config/backup/app-config.backup.TIMESTAMP.json`
- **Acceso**: Endpoints `/api/config/save`, `/api/config/load`, `/api/config/clear`

---

## 🔗 Integración con Otras Pestañas

### Parser Tab (Pestaña 2)
- Usa la configuración del Connector para leer el archivo CSV
- Valida que el Connector esté configurado y guardado
- Desencripta credenciales automáticamente

### Mapping Tab (Pestaña 3)
- Depende del Parser para conocer las columnas del CSV
- Requiere que el Parser esté validado

### Validation Tab (Pestaña 4)
- Usa la configuración completa (Connector + Parser + Mapping)
- Valida el flujo completo

### Persistence Tab (Pestaña 5)
- Guarda toda la configuración (Connector + Parser + Mapping)
- Permite cargar configuraciones guardadas

---

## 🛠️ Endpoints Backend Relacionados

### POST /test-connection
- **Propósito**: Probar conexión y detectar archivo
- **Parámetros**: path, pattern, username, password, domain
- **Respuesta**: {status, file, logs}
- **Documentación**: Ver `docs/API-ENDPOINT.md`

### POST /api/config/save
- **Propósito**: Guardar configuración
- **Parámetros**: Objeto de configuración completo
- **Respuesta**: {status, message, path}

### GET /api/config/load
- **Propósito**: Cargar configuración guardada
- **Parámetros**: Ninguno
- **Respuesta**: {status, config}

### DELETE /api/config/clear
- **Propósito**: Eliminar configuración guardada
- **Parámetros**: Ninguno
- **Respuesta**: {status, message}

---

## 📝 Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `src/pages/csv-integration.html` | Interfaz HTML del Connector |
| `src/js/csv-integration.js` | Lógica del Connector (test, save) |
| `src/js/credential-crypto.js` | Encriptación/desencriptación frontend |
| `src/js/network-path-client.js` | Cliente HTTP para backend |
| `src/js/config-loader.js` | Carga y persiste configuración |
| `backend/credential-crypto.js` | Desencriptación backend |
| `backend/network-path-handler-windows.js` | Acceso SMB via PowerShell |
| `server.js` | Endpoints Express |
| `docs/API-ENDPOINT.md` | Documentación API |

---

## 🎓 Ejemplos de Uso

### Ejemplo 1: Conexión Simple (Sin Autenticación)

```
1. Connection Type: Network Path
2. Path: \\192.168.1.100\shared
3. File Name Pattern: *.csv
4. Authentication: Desmarcar
5. Click "Test Connection"
6. Si success → Click "Save Configuration"
```

### Ejemplo 2: Conexión con Autenticación

```
1. Connection Type: Network Path
2. Path: \\server.company.com\data
3. File Name Pattern: medications_*.csv
4. Authentication: Marcar
5. Username: john_doe
6. Password: mypassword123
7. Domain: Marcar
8. Domain: COMPANY
9. Click "Test Connection"
10. Si success → Click "Save Configuration"
```

### Ejemplo 3: SFTP con Contraseña

```
1. Connection Type: SFTP
2. Host: sftp.example.com
3. Port: 22
4. Username: sftp_user
5. Authentication Type: Password
6. Password: sftp_password
7. Remote Path: /incoming
8. File Name Pattern: export_*.csv
9. Click "Test Connection"
10. Si success → Click "Save Configuration"
```

---

## 🚀 Mejoras Futuras

1. **Historial de conexiones**: Guardar últimas conexiones exitosas
2. **Validación de credenciales**: Verificar antes de guardar
3. **Detección automática de patrón**: Sugerir patrones basados en archivos encontrados
4. **Prueba de lectura**: Leer primeras líneas del archivo para validar formato
5. **Soporte para más tipos de conexión**: Google Drive, Azure, AWS S3
6. **Interfaz de selección de archivo**: Mostrar lista de archivos y permitir seleccionar

---

## 📞 Soporte

Para más información:
- Ver `docs/API-ENDPOINT.md` para detalles técnicos del API
- Ver `docs/FLUJO-COMPLETO.md` para flujo general del proyecto
- Revisar logs en la consola del navegador (F12)
- Revisar logs del backend en la terminal
