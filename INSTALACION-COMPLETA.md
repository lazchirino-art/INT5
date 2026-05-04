# Instalación Completa - POC SMB Network Path

**Para usuarios sin nada instalado: Git, Node.js, npm, etc.**

---

## Paso 1: Instalar Node.js

### 1.1 Descargar Node.js

1. Abre navegador y ve a: https://nodejs.org/
2. Descarga la versión **LTS** (recomendada)
3. Espera a que descargue el archivo `.msi`

### 1.2 Instalar Node.js

1. Abre el archivo descargado (`.msi`)
2. Haz click en **"Next"** varias veces
3. Acepta los términos y condiciones
4. Haz click en **"Install"**
5. Espera a que termine
6. Haz click en **"Finish"**

### 1.3 Verificar Instalación

1. Abre **PowerShell** o **CMD**
2. Ejecuta:
   ```powershell
   node --version
   npm --version
   ```
3. Deberías ver versiones (ej: `v18.17.0`)

---

## Paso 2: Habilitar PowerShell (si usas PowerShell)

### 2.1 Abrir PowerShell como Administrador

1. Click derecho en el escritorio
2. Selecciona **"Windows PowerShell (Admin)"** o **"Terminal (Admin)"**
3. Haz click en **"Sí"** si pide confirmación

### 2.2 Habilitar Scripts

Ejecuta:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Responde **`Y`** cuando pregunte.

### 2.3 Verificar

```powershell
npm --version
```

Deberías ver la versión de npm.

---

## Paso 3: Descargar el Proyecto

### 3.1 Opción A: Descargar ZIP (Sin Git)

**Si NO tienes Git instalado, usa esto:**

1. Abre navegador: https://github.com/lazchirino-art/INT5
2. Haz click en botón verde **"Code"**
3. Haz click en **"Download ZIP"**
4. Espera a que descargue
5. Abre el archivo ZIP descargado
6. Extrae en una carpeta (ej: `C:\Users\TuUsuario\Documentos\INT5`)

### 3.2 Opción B: Descargar con Comando (Sin Git)

Abre PowerShell o CMD y ejecuta:

```powershell
Invoke-WebRequest -Uri "https://github.com/lazchirino-art/INT5/archive/refs/heads/main.zip" -OutFile "INT5.zip"
Expand-Archive -Path "INT5.zip" -DestinationPath "."
cd INT5-main
```

---

## Paso 4: Instalar Dependencias

### 4.1 Abrir Terminal en la Carpeta del Proyecto

1. Abre PowerShell o CMD
2. Navega a la carpeta:
   ```powershell
   cd C:\ruta\a\INT5-main
   ```
   (Reemplaza `C:\ruta\a\INT5-main` con tu ruta real)

### 4.2 Instalar npm packages

Ejecuta:

```powershell
npm install
```

Espera a que termine (puede tomar 1-2 minutos).

Deberías ver:

```
added XXX packages in XXs
```

---

## Paso 5: Iniciar el Servidor

### 5.1 Ejecutar el Servidor

En la misma terminal, ejecuta:

```powershell
npm start
```

Deberías ver algo como:

```
==================================================
Backend Server
==================================================

✔ Server running on port 3000
✔ URL: http://localhost:3000
✔ Endpoint: POST /test-connection

==================================================
```

### 5.2 El Servidor está Corriendo

**NO cierres esta terminal.** El servidor necesita estar corriendo.

---

## Paso 6: Abrir en Navegador

### 6.1 Abrir la Aplicación

1. Abre tu navegador (Chrome, Edge, Firefox, etc.)
2. Ve a: `http://localhost:3000`
3. Deberías ver el menú principal con botones

---

## Paso 7: Usar la Aplicación

### 7.1 Ir a CSV Integration

1. Haz click en botón **"CSV"** (en sección "Integraciones")
2. Se abre formulario de configuración
3. Selecciona **"Network Path"** en "Connection Type"

### 7.2 Ingresar Datos

Rellena los campos:

| Campo | Ejemplo |
|-------|---------|
| **Path** | `\\servidor-local\compartida\medicinas` |
| **File Name Pattern** | `medications_*.csv` |
| **Authentication** | ✓ (marcar si necesita) |
| **Username** | `tu_usuario` |
| **Password** | `tu_contraseña` |
| **Use Domain** | ✓ (marcar si necesita) |
| **Domain** | `TU_DOMINIO` |

### 7.3 Probar Conexión

1. Haz click en **"Test Connection"**
2. Espera a que termine (2-5 segundos)
3. Verás logs en la pantalla

**Si ves "STATUS: READY":**
- ✓ Conexión exitosa
- ✓ Archivo detectado
- ✓ Puedes hacer click en "Save Configuration"

**Si ves "STATUS: FAILED":**
- ✗ Verificar ruta
- ✗ Verificar credenciales
- ✗ Verificar que el servidor SMB esté accesible

### 7.4 Guardar Configuración

Si el status es **READY**:

1. Haz click en **"Save Configuration"**
2. Verás: `SAVE: GUARDADO`
3. Las credenciales se guardan encriptadas

### 7.5 Próxima Vez

Cuando vuelvas a abrir la página:
- Los datos se cargan automáticamente
- Solo haz click en "Test Connection"

---

## Paso 8: Detener el Servidor

### 8.1 Cuando Termines

En la terminal donde corre el servidor:

1. Presiona **`Ctrl + C`**
2. Responde **`Y`** si pide confirmación
3. El servidor se detiene

### 8.2 Volver a Iniciar

```powershell
npm start
```

---

## Troubleshooting

### Error: "npm is not recognized"

**Solución:**
1. Reinstala Node.js
2. Reinicia PowerShell/CMD completamente
3. Verifica: `npm --version`

### Error: "Cannot find path"

**Solución:**
1. Verifica que la ruta SMB sea correcta
2. Prueba en File Explorer: `\\servidor-local\compartida`
3. Verifica que el servidor SMB esté encendido

### Error: "Access is denied"

**Solución:**
1. Verifica usuario/contraseña
2. Verifica permisos en la carpeta compartida
3. Prueba credenciales en File Explorer

### Error: "Port 3000 is already in use"

**Solución:**
1. Cierra otras aplicaciones que usen puerto 3000
2. O usa otro puerto: `npm start -- --port 3001`

### Error: "Cannot GET /"

**Solución:**
1. Verifica que el servidor está corriendo
2. Verifica que abriste `http://localhost:3000` (no `http://localhost`)
3. Recarga la página: `Ctrl + R`

### Error: "Scripts are disabled"

**Solución:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Estructura del Proyecto

```
INT5-main/
├── server.js                    ← Inicia aquí (npm start)
├── package.json                 ← Dependencias
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
│   │   └── csv-integration.css
├── docs/
│   ├── FLUJO-COMPLETO.md
│   └── API-ENDPOINT.md
└── INICIO-RAPIDO.md
```

---

## Resumen de Comandos

```powershell
# 1. Descargar
Invoke-WebRequest -Uri "https://github.com/lazchirino-art/INT5/archive/refs/heads/main.zip" -OutFile "INT5.zip"
Expand-Archive -Path "INT5.zip" -DestinationPath "."
cd INT5-main

# 2. Instalar
npm install

# 3. Iniciar
npm start

# 4. Abrir navegador
# http://localhost:3000
```

---

## Próximos Pasos

1. Leer `INICIO-RAPIDO.md` para guía rápida
2. Leer `docs/FLUJO-COMPLETO.md` para arquitectura
3. Probar conexión a tu ruta SMB
4. Guardar configuración
5. Usar la aplicación

---

## Soporte

Si tienes problemas:

1. Verifica que Node.js está instalado: `node --version`
2. Verifica que npm está instalado: `npm --version`
3. Verifica que el servidor está corriendo: `npm start`
4. Verifica que abres `http://localhost:3000` (no otra URL)
5. Revisa la consola del navegador: `F12 → Console`
6. Revisa los logs del servidor en la terminal

---

**¡Listo para empezar!**
