# Backend SMB - Documentación Técnica

## Descripción General

El backend SMB es un servidor Node.js que proporciona acceso a rutas de red compartidas (SMB/CIFS) usando la librería `smb2`.

**Arquitectura:**
- Frontend (HTML/JS) → HTTP → Backend Node.js → SMB2 → Red Compartida

## Instalación

### 1. Instalar Dependencias

```bash
npm install
```

Esto instala:
- `express` - Framework web
- `smb2` - Cliente SMB2 para Node.js
- `cors` - Manejo de CORS
- `dotenv` - Variables de entorno

### 2. Iniciar el Servidor

```bash
npm start
```

O en modo desarrollo:

```bash
npm run dev
```

El servidor correrá en `http://localhost:3000`

## Endpoints API

### 1. Health Check

**GET** `/api/health`

Verifica que el servidor está disponible.

**Respuesta:**
```json
{
  "status": "OK",
  "timestamp": "2024-04-29T13:45:30.123Z",
  "service": "POC Embedded App Backend"
}
```

### 2. Detectar Archivo CSV

**POST** `/api/smb/detect`

Detecta un archivo CSV basado en un patrón.

**Body:**
```json
{
  "path": "\\\\servidor\\compartida\\datos",
  "username": "usuario",
  "password": "contraseña",
  "domain": "DOMINIO",
  "pattern": "datos_*.csv"
}
```

**Respuesta (Éxito):**
```json
{
  "status": "READY",
  "selectedFile": "datos_2024.csv",
  "logs": [
    {
      "timestamp": "2024-04-29T13:45:30.123Z",
      "message": "Iniciando detección de archivos...",
      "type": "info",
      "prefix": "ℹ Iniciando detección de archivos..."
    },
    ...
  ]
}
```

**Respuesta (Error - No encontrado):**
```json
{
  "status": "FAILED",
  "error": "FILE_NOT_FOUND",
  "message": "No se encontró ningún archivo que coincida con el patrón",
  "logs": [...]
}
```

**Respuesta (Error - Múltiples):**
```json
{
  "status": "FAILED",
  "error": "MULTIPLE_FILES_FOUND",
  "message": "Se encontraron 3 archivos coincidentes",
  "files": ["datos_2024.csv", "datos_2025.csv", "datos_backup.csv"],
  "logs": [...]
}
```

### 3. Listar Archivos

**POST** `/api/smb/list`

Lista todos los archivos en una carpeta SMB.

**Body:**
```json
{
  "path": "\\\\servidor\\compartida\\datos",
  "username": "usuario",
  "password": "contraseña",
  "domain": "DOMINIO"
}
```

**Respuesta:**
```json
{
  "status": "READY",
  "files": [
    {
      "name": "datos_2024.csv",
      "isDirectory": false,
      "size": 1024,
      "modified": "2024-04-29T10:00:00Z"
    },
    {
      "name": "carpeta_datos",
      "isDirectory": true,
      "size": 0,
      "modified": "2024-04-29T10:00:00Z"
    }
  ],
  "logs": [...]
}
```

### 4. Verificar Conexión

**POST** `/api/smb/verify`

Verifica que se puede conectar a la ruta SMB.

**Body:**
```json
{
  "path": "\\\\servidor\\compartida\\datos",
  "username": "usuario",
  "password": "contraseña",
  "domain": "DOMINIO"
}
```

**Respuesta:**
```json
{
  "status": "READY",
  "connected": true,
  "logs": [...]
}
```

## Códigos de Error

| Código | Descripción |
|--------|------------|
| `FILE_NOT_FOUND` | No se encontró archivo coincidente |
| `MULTIPLE_FILES_FOUND` | Se encontraron múltiples archivos |
| `INVALID_PATH` | La ruta UNC no es válida |
| `CONNECTION_FAILED` | Falló la conexión a SMB |
| `AUTHENTICATION_FAILED` | Falló la autenticación |
| `ACCESS_DENIED` | Acceso denegado a la carpeta |
| `FOLDER_NOT_FOUND` | La carpeta no existe |
| `UNEXPECTED_ERROR` | Error inesperado |
| `MISSING_PARAMETERS` | Faltan parámetros en la solicitud |
| `SERVER_ERROR` | Error interno del servidor |

## Estructura del Código

### `server.js`
Servidor Express principal. Define los endpoints y maneja las solicitudes HTTP.

### `backend/smb-file-detector-backend.js`
Clase `SMB2FileDetector` que maneja:
- Validación de credenciales
- Conexión a SMB usando `smb2`
- Listado de archivos
- Coincidencia de patrones
- Logs detallados

## Patrones Soportados

### Wildcard (*)
```javascript
'datos_*.csv'      // datos_2024.csv, datos_2025.csv
'*_reporte.csv'    // enero_reporte.csv, febrero_reporte.csv
'*.csv'            // cualquier .csv
```

### Exacto
```javascript
'datos.csv'        // Solo datos.csv
'reporte_2024.csv' // Solo reporte_2024.csv
```

## Autenticación

### Sin Dominio
```json
{
  "username": "usuario",
  "password": "contraseña"
}
```

Usa: `usuario`

### Con Dominio
```json
{
  "username": "usuario",
  "password": "contraseña",
  "domain": "EMPRESA"
}
```

Usa: `EMPRESA\usuario`

## Logs

Cada solicitud genera logs detallados con:
- Timestamp ISO 8601
- Tipo (info, success, error, warning)
- Mensaje descriptivo

**Ejemplo:**
```
✔ Resolviendo ruta: \\servidor\compartida\datos
✔ Conectando a: \\servidor\compartida
✔ Autenticando como: EMPRESA\usuario
✔ Conexión exitosa
✔ Autenticación exitosa
✔ Accediendo a carpeta
✔ Carpeta accesible
✔ Archivos encontrados: 5
✔ Aplicando patrón: datos_*.csv
✔ Archivos coincidentes: 1
✔ Archivo seleccionado: datos_2024.csv
✔ Detección completada exitosamente
```

## Limitaciones Actuales

- ✗ No soporta búsqueda recursiva en subcarpetas
- ✗ No filtra por tipo de archivo (solo por nombre)
- ✗ No soporta caracteres especiales en patrones (excepto *)
- ✗ Timeout fijo para conexiones

## Mejoras Futuras

- [ ] Soporte para búsqueda recursiva
- [ ] Caché de conexiones
- [ ] Reintentos automáticos
- [ ] Timeout configurable
- [ ] Soporte para caracteres especiales en patrones
- [ ] Filtrado por tipo de archivo
- [ ] Compresión de respuestas

## Troubleshooting

### Error: "Cannot find module 'smb2'"

**Solución:**
```bash
npm install
```

### Error: "ECONNREFUSED"

**Causa:** No se puede conectar a la ruta SMB

**Soluciones:**
- Verifica que la ruta es correcta
- Verifica que el servidor está disponible en la red
- Verifica credenciales
- Verifica firewall

### Error: "Authentication failed"

**Causa:** Credenciales incorrectas

**Soluciones:**
- Verifica usuario y contraseña
- Verifica que el dominio es correcto (si aplica)
- Intenta sin dominio si es un servidor local

### Error: "Access denied"

**Causa:** El usuario no tiene permisos

**Soluciones:**
- Verifica permisos de carpeta
- Usa un usuario con permisos suficientes
- Verifica que la carpeta compartida está accesible

## Desarrollo

### Modo Debug

Agrega logs adicionales editando `backend/smb-file-detector-backend.js`:

```javascript
// Habilitar logs detallados
console.log('DEBUG:', data);
```

### Testing Manual

```bash
# Verificar servidor
curl http://localhost:3000/api/health

# Detectar archivo
curl -X POST http://localhost:3000/api/smb/detect \
  -H "Content-Type: application/json" \
  -d '{
    "path": "\\\\servidor\\compartida",
    "username": "usuario",
    "password": "contraseña",
    "pattern": "*.csv"
  }'
```

## Seguridad

### Consideraciones

1. **Credenciales en tránsito:** Usa HTTPS en producción
2. **Credenciales en logs:** Los logs pueden contener información sensible
3. **Validación:** Valida todas las entradas
4. **CORS:** Configura CORS apropiadamente en producción

### Recomendaciones

```javascript
// En producción, usar variables de entorno
const username = process.env.SMB_USERNAME;
const password = process.env.SMB_PASSWORD;

// Usar HTTPS
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(3000);
```

## Contacto y Soporte

Para preguntas o problemas, revisa los logs del servidor o consulta la documentación de `smb2`.

## Referencias

- [smb2 - NPM](https://www.npmjs.com/package/smb2)
- [Express.js](https://expressjs.com/)
- [SMB Protocol](https://en.wikipedia.org/wiki/Server_Message_Block)
