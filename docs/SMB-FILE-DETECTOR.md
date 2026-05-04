# SMB File Detector - Documentación Técnica

## Descripción General

El módulo **SMBFileDetector** es un componente genérico diseñado para acceder a rutas de red (SMB), listar archivos y detectar un CSV basado en un patrón configurable.

**Características principales:**
- ✅ Conexión a rutas de red compartidas (SMB/CIFS)
- ✅ Soporte para autenticación con dominio opcional
- ✅ Listado de archivos dinámico
- ✅ Coincidencia de patrones (exacto y wildcard)
- ✅ Validación paso a paso
- ✅ Logs detallados para debugging
- ✅ Manejo robusto de errores

## Instalación

### Incluir en HTML

```html
<script src="src/js/smb-file-detector.js"></script>
```

### Usar en JavaScript

```javascript
const detector = new SMBFileDetector();
```

## API

### Constructor

```javascript
const detector = new SMBFileDetector();
```

Crea una nueva instancia del detector.

### Método Principal: `detect(credentials)`

```javascript
const result = await detector.detect(credentials);
```

**Parámetros:**

```javascript
{
  path: string,           // Ruta UNC (ej: \\servidor\compartida\datos)
  username: string,       // Nombre de usuario
  password: string,       // Contraseña
  domain: string,         // Dominio (opcional)
  pattern: string         // Patrón de archivo (ej: datos_*.csv)
}
```

**Retorna:**

```javascript
{
  status: 'READY' | 'FAILED' | 'PROCESSING',
  selectedFile: string | null,
  error: string | null,
  message: string | null,
  files: array | null,
  logs: array
}
```

## Ejemplos de Uso

### Ejemplo 1: Uso Básico

```javascript
const detector = new SMBFileDetector();

const credentials = {
  path: '\\\\servidor\\compartida\\datos',
  username: 'usuario',
  password: 'contraseña',
  pattern: 'datos_*.csv'
};

const result = await detector.detect(credentials);

if (result.status === 'READY') {
  console.log('Archivo encontrado:', result.selectedFile);
} else {
  console.log('Error:', result.message);
}
```

### Ejemplo 2: Con Dominio

```javascript
const credentials = {
  path: '\\\\servidor.empresa.com\\compartida\\reportes',
  username: 'juan.perez',
  password: 'MiContraseña123',
  domain: 'EMPRESA',
  pattern: 'reporte_*.csv'
};

const result = await detector.detect(credentials);
```

### Ejemplo 3: Patrón Exacto

```javascript
const credentials = {
  path: '\\\\192.168.1.100\\archivos',
  username: 'admin',
  password: 'admin123',
  pattern: 'datos.csv'  // Sin wildcards
};

const result = await detector.detect(credentials);
```

### Ejemplo 4: Manejo de Errores

```javascript
const result = await detector.detect(credentials);

switch (result.status) {
  case 'READY':
    console.log('Archivo:', result.selectedFile);
    break;
  case 'FAILED':
    if (result.error === 'FILE_NOT_FOUND') {
      console.log('Archivo no encontrado');
    } else if (result.error === 'MULTIPLE_FILES_FOUND') {
      console.log('Múltiples archivos encontrados:', result.files);
    } else {
      console.log('Error:', result.message);
    }
    break;
}
```

## Patrones Soportados

### Wildcard (*)

El asterisco (*) coincide con cualquier secuencia de caracteres.

```javascript
// Ejemplos
'datos_*.csv'      // datos_2024.csv, datos_2025.csv, datos_final.csv
'*_reporte.csv'    // enero_reporte.csv, febrero_reporte.csv
'*.csv'            // cualquier archivo .csv
'archivo_*_v*.csv' // archivo_datos_v1.csv, archivo_logs_v2.csv
```

### Patrón Exacto

Sin wildcards, busca coincidencia exacta.

```javascript
// Ejemplos
'datos.csv'        // Solo datos.csv
'reporte_2024.csv' // Solo reporte_2024.csv
```

## Flujo de Validación

El módulo ejecuta validación paso a paso:

1. ✔ **Validar credenciales** - Verificar que todos los parámetros sean válidos
2. ✔ **Resolver ruta** - Normalizar y validar la ruta UNC
3. ✔ **Conectar a red** - Establecer conexión al recurso compartido
4. ✔ **Autenticar** - Validar credenciales de usuario
5. ✔ **Verificar acceso** - Confirmar acceso a la carpeta
6. ✔ **Listar archivos** - Obtener lista de archivos
7. ✔ **Aplicar patrón** - Filtrar archivos por patrón
8. ✔ **Seleccionar archivo** - Validar y seleccionar archivo

## Logs

Cada paso genera logs detallados para debugging.

### Acceder a Logs

```javascript
const result = await detector.detect(credentials);

// Acceder a logs
result.logs.forEach(log => {
  console.log(`[${log.timestamp}] ${log.prefix}`);
});
```

### Exportar Logs

```javascript
const logsString = detector.exportLogs();
console.log(logsString);
```

### Estructura de Log

```javascript
{
  timestamp: '2024-04-29T13:45:30.123Z',
  message: 'Resolviendo ruta: \\\\servidor\\compartida',
  type: 'info',  // 'info', 'success', 'error', 'warning'
  prefix: 'ℹ Resolviendo ruta: \\\\servidor\\compartida'
}
```

## Códigos de Error

| Código | Descripción |
|--------|------------|
| `FILE_NOT_FOUND` | No se encontró ningún archivo coincidente |
| `MULTIPLE_FILES_FOUND` | Se encontraron múltiples archivos coincidentes |
| `INVALID_PATH` | La ruta no es válida |
| `CONNECTION_FAILED` | Falló la conexión a la red |
| `AUTHENTICATION_FAILED` | Falló la autenticación |
| `ACCESS_DENIED` | Acceso denegado a la carpeta |
| `FOLDER_NOT_FOUND` | La carpeta no existe |
| `UNEXPECTED_ERROR` | Error inesperado |

## Métodos Adicionales

### `getStateSummary()`

Obtiene un resumen del estado actual.

```javascript
const summary = detector.getStateSummary();
console.log(summary);
// {
//   state: { pathResolved, connected, authenticated, ... },
//   result: { status, selectedFile, ... },
//   logs: [...]
// }
```

### `exportLogs()`

Exporta los logs como string formateado.

```javascript
const logsString = detector.exportLogs();
console.log(logsString);
```

### `patternToRegex(pattern)`

Convierte un patrón wildcard a expresión regular.

```javascript
const regex = detector.patternToRegex('datos_*.csv');
const matches = ['datos_2024.csv', 'datos_2025.csv'].filter(f => regex.test(f));
```

## Integración con UI

### HTML

```html
<form id="smbForm">
  <input type="text" id="networkPath" placeholder="\\servidor\compartida" />
  <input type="text" id="username" placeholder="Usuario" />
  <input type="password" id="password" placeholder="Contraseña" />
  <input type="text" id="domain" placeholder="Dominio (opcional)" />
  <input type="text" id="filePattern" placeholder="Patrón (ej: datos_*.csv)" />
  <button type="button" onclick="handleDetect()">Detectar</button>
</form>

<div id="result"></div>
<div id="logs"></div>
```

### JavaScript

```javascript
async function handleDetect() {
  const credentials = {
    path: document.getElementById('networkPath').value,
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    domain: document.getElementById('domain').value,
    pattern: document.getElementById('filePattern').value
  };

  const detector = new SMBFileDetector();
  const result = await detector.detect(credentials);

  // Mostrar resultado
  const resultDiv = document.getElementById('result');
  if (result.status === 'READY') {
    resultDiv.innerHTML = `
      <div class="success">
        <h3>✔ Éxito</h3>
        <p>Archivo: <strong>${result.selectedFile}</strong></p>
      </div>
    `;
  } else {
    resultDiv.innerHTML = `
      <div class="error">
        <h3>❌ Error</h3>
        <p>${result.message}</p>
      </div>
    `;
  }

  // Mostrar logs
  const logsDiv = document.getElementById('logs');
  logsDiv.innerHTML = result.logs
    .map(log => `<div class="log log-${log.type}">${log.prefix}</div>`)
    .join('');
}
```

## Consideraciones de Implementación

### En Navegador

Este módulo está diseñado como una abstracción. En un navegador real:

1. **No puedes acceder directamente a SMB** desde JavaScript por razones de seguridad
2. **Necesitas un backend** que maneje la conexión SMB
3. **El backend debe exponer un endpoint** que:
   - Reciba credenciales
   - Conecte a la red
   - Liste archivos
   - Retorne el resultado

### En Node.js

Para usar en Node.js, necesitas:

```bash
npm install smb2
```

Luego adaptar el módulo para usar la librería real:

```javascript
const SMB2 = require('smb2');

async connectToNetwork(params) {
  const smb2Client = new SMB2({
    host: params.server,
    username: params.username,
    password: params.password,
    domain: params.domain
  });

  // Conectar y listar archivos...
}
```

### En Aplicación Embebida

Para una aplicación embebida (como en tu caso):

1. **Usa un backend local** (Node.js, Python, etc.)
2. **Expone un endpoint REST** que maneje SMB
3. **Llama desde el frontend** al endpoint

```javascript
async detect(credentials) {
  const response = await fetch('/api/smb/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });

  return await response.json();
}
```

## Mejores Prácticas

1. **Nunca hardcodees credenciales** - Siempre obtén del usuario
2. **Valida entrada** - El módulo lo hace, pero valida también en UI
3. **Maneja errores** - Usa los códigos de error para mensajes específicos
4. **Revisa logs** - Útiles para debugging
5. **Usa HTTPS** - Si transmites credenciales por red
6. **Limpia contraseñas** - Después de usar, limpia de memoria si es posible

## Limitaciones Actuales

- ✗ No accede realmente a SMB en navegador (necesita backend)
- ✗ No soporta caracteres especiales en patrones (excepto *)
- ✗ No soporta búsqueda recursiva en subcarpetas
- ✗ No filtra por tipo de archivo (solo por nombre)

## Próximas Mejoras

- [ ] Soporte para búsqueda recursiva
- [ ] Filtrado por tipo de archivo
- [ ] Soporte para caracteres especiales en patrones
- [ ] Caché de conexiones
- [ ] Reintentos automáticos
- [ ] Timeout configurable

## Contacto y Soporte

Para preguntas o problemas, consulta la documentación o revisa los ejemplos en `smb-file-detector.example.js`.
