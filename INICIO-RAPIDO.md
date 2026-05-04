# Inicio Rápido - POC SMB Network Path

## 1. Preparación

### Requisitos
- Windows 10/11
- Node.js 18+ instalado
- Acceso a ruta SMB en tu red local

### Clonar/Actualizar Proyecto

```bash
cd INT5
git pull origin main
npm install
```

## 2. Iniciar Servidor

```bash
npm start
```

Verás:
```
==================================================
Backend Server
==================================================

✔ Server running on port 3000
✔ URL: http://localhost:3000
✔ Endpoint: POST /test-connection

==================================================
```

## 3. Abrir en Navegador

```
http://localhost:3000
```

Deberías ver el menú principal con botones de navegación.

## 4. Ir a CSV Integration

1. Click en botón **"CSV"** (en sección "Integraciones")
2. Se abre formulario de configuración
3. Selecciona **"Network Path"** en "Connection Type"

## 5. Ingresar Datos de Conexión

### Ejemplo Real

```
Path: \\servidor-local\compartida\medicinas
File Name Pattern: medications_*.csv
Authentication: ✓ (marcar si necesita)
  Username: tu_usuario
  Password: tu_contraseña
Use Domain: ✓ (marcar si necesita)
  Domain: TU_DOMINIO
```

### Ejemplos de Patrones

| Patrón | Coincide con |
|--------|-------------|
| `*.csv` | Cualquier CSV |
| `medications_*.csv` | `medications_20260502.csv` |
| `medications_202605*.csv` | `medications_20260501.csv`, `medications_20260502.csv` |
| `report.csv` | Solo `report.csv` |

## 6. Probar Conexión

Click en **"Test Connection"**

### Resultado Esperado

**✓ STATUS: READY**
```
✓ Iniciando conexión...
✓ Ruta: \\servidor-local\compartida\medicinas
✓ Patrón: medications_*.csv
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

El botón "Save Configuration" se activa.

### Errores Comunes

**✗ Cannot find path**
- Verificar que la ruta sea correcta
- Verificar que el servidor SMB esté encendido
- Probar: `net use \\servidor-local\compartida`

**✗ Access is denied**
- Verificar usuario/contraseña
- Verificar permisos en la carpeta
- Probar credenciales en File Explorer

**✗ Multiple files found**
- Ajustar patrón para ser más específico
- Ej: `medications_202605*.csv` en lugar de `medications_*.csv`

## 7. Guardar Configuración

Si el resultado es **READY**:

Click en **"Save Configuration"**

Verás: `SAVE: GUARDADO`

Las credenciales se encriptan y guardan en el navegador.

## 8. Próxima Vez

Cuando vuelvas a abrir la página:
- Los datos se cargan automáticamente
- Puedes hacer click directo en "Test Connection"
- No necesitas ingresar datos nuevamente

## Estructura del Proyecto

```
INT5/
├── server.js                    ← Inicia aquí (npm start)
├── backend/
│   └── network-path-handler-windows.js  ← Lógica SMB
├── src/
│   ├── pages/
│   │   ├── index.html          ← Menú principal
│   │   └── csv-integration.html  ← Formulario
│   ├── js/
│   │   ├── network-path-client.js       ← Cliente HTTP
│   │   ├── credential-crypto.js         ← Encriptación
│   │   ├── config-loader.js             ← Cargar config
│   │   └── csv-integration.js ← Lógica formulario
│   └── styles/
│       └── csv-integration.css
└── docs/
    ├── FLUJO-COMPLETO.md       ← Documentación detallada
    └── API-ENDPOINT.md         ← Especificación del endpoint
```

## Troubleshooting

### "Cannot GET /"
- Verificar que el servidor está corriendo: `npm start`
- Verificar puerto 3000: `netstat -ano | findstr :3000`

### CSS/JS no carga
- Limpiar caché del navegador: `Ctrl+Shift+Delete`
- Reiniciar servidor: `npm start`

### Conexión rechazada
- Verificar que Node.js está instalado: `node -v`
- Verificar que npm install completó: `npm list`

### Credenciales no se guardan
- Verificar que localStorage está habilitado en el navegador
- Verificar que el status es READY (no FAILED)
- Verificar consola del navegador: `F12 → Console`

## Próximos Pasos

1. **Leer CSV**: Después de detectar archivo, leerlo y parsearlo
2. **Validar datos**: Validar estructura y tipos
3. **Transformar**: Mapear columnas a esquema
4. **Guardar**: Persistir en base de datos
5. **Automatizar**: Ejecutar periódicamente

Ver `docs/FLUJO-COMPLETO.md` para detalles técnicos.

## Soporte

- Revisar logs en consola del navegador: `F12`
- Revisar logs del servidor en terminal
- Consultar `docs/API-ENDPOINT.md` para especificación del endpoint
- Consultar `docs/FLUJO-COMPLETO.md` para arquitectura completa
