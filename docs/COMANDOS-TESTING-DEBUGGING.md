# INT5 - Comandos para Testing y Debugging

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Para reproducir el entorno de seguridad del kiosco en desarrollo, ejecutar el servidor con `runas /user:int5svc` (ver guía de despliegue).

## 📋 Tabla de Contenidos

1. [Comandos Git](#comandos-git)
2. [Comandos Node.js](#comandos-nodejs)
3. [Comandos PowerShell (Windows)](#comandos-powershell-windows)
4. [Comandos de Generación de Secretos](#comandos-de-generación-de-secretos)
5. [Comandos de Testing de Conexión](#comandos-de-testing-de-conexión)
6. [Comandos de Debugging](#comandos-de-debugging)
7. [Flujos Completos de Testing](#flujos-completos-de-testing)

---

## Comandos Git

### Clonar Repositorio

```bash
git clone https://github.com/lazchirino-art/INT5.git
cd INT5
```

**Descripción**: Clona el repositorio del proyecto INT5 a tu máquina local.

---

### Ver Estado del Repositorio

```bash
git status
```

**Descripción**: Muestra archivos modificados, sin seguimiento y cambios pendientes de commit.

**Salida esperada**:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

---

### Ver Historial de Commits

```bash
git log --oneline -10
```

**Descripción**: Muestra los últimos 10 commits con hash corto y mensaje.

**Salida esperada**:
```
c52323d docs: Add comprehensive technical architecture documentation
7f2f568 docs: Add comprehensive Connector tab documentation
13c0af2 Fix: Silence net use output to avoid mixing with file content
fbfd7a6 Fix: Use net use instead of Get-Content with credentials
ec18d04 Fix: Add CredentialCrypto to /api/connector/read-file endpoint
92f78a2 Refactor: Organize project structure and fix decryption bug
...
```

---

### Agregar Cambios a Staging

```bash
git add -A
```

**Descripción**: Agrega todos los cambios (modificados, nuevos, eliminados) al área de staging.

**Alternativas**:
```bash
git add .                    # Agregar todos en directorio actual
git add src/js/archivo.js    # Agregar archivo específico
git add docs/                # Agregar directorio completo
```

---

### Hacer Commit

```bash
git commit -m "Descripción del cambio"
```

**Descripción**: Crea un commit con los cambios en staging.

**Ejemplo**:
```bash
git commit -m "Fix: Corregir desencriptación de credenciales"
```

---

### Hacer Pull (Descargar Cambios)

```bash
git pull origin main
```

**Descripción**: Descarga cambios del repositorio remoto e integra en rama local.

**Salida esperada**:
```
From https://github.com/lazchirino-art/INT5
 * branch            main       -> FETCH_HEAD
Already up to date.
```

**Si hay cambios**:
```
Updating 49073ba..92f78a2
Fast-forward
 backend/network-path-handler-windows.js | 21 +++++++++++++++++++++
 server.js                               | 15 +++++++++++++++
 2 files changed, 36 insertions(+)
```

---

### Hacer Push (Subir Cambios)

```bash
git push origin main
```

**Descripción**: Sube commits locales al repositorio remoto.

**Con autenticación PAT**:
```bash
git push https://lazchirino-art:github_pat_XXXXX@github.com/lazchirino-art/INT5.git main
```

**Salida esperada**:
```
Enumerating objects: 6, done.
Counting objects: 100% (6/6), done.
Delta compression using 4 threads, done.
Writing objects: 100% (4/4), 10.78 KiB | 5.39 MiB/s, done.
Total 4 (delta 2), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (2/2), completed with 2 local objects.
To https://github.com/lazchirino-art/INT5.git
   7f2f568..c52323d  main -> main
```

---

### Descartar Cambios Locales

```bash
git reset --hard origin/main
```

**Descripción**: Descarta todos los cambios locales y sincroniza con el repositorio remoto.

**⚠️ ADVERTENCIA**: Esto elimina cambios no guardados. Usar solo si estás seguro.

---

### Ver Cambios en Archivo Específico

```bash
git diff backend/network-path-handler-windows.js
```

**Descripción**: Muestra las diferencias en un archivo específico.

---

## Comandos Node.js

### Instalar Dependencias

```bash
npm install
```

**Descripción**: Instala todas las dependencias del `package.json`.

**Salida esperada**:
```
added 50 packages, and audited 51 packages in 2s

found 0 vulnerabilities
```

---

### Iniciar Servidor Backend

```bash
node server.js
```

**Descripción**: Inicia el servidor Express en puerto 3000.

**Salida esperada**:
```
🔥 ESTE ES MI SERVER REAL 🔥

==================================================
Backend Server
==================================================

✔ Server running on port 3000
✔ URL: http://localhost:3000
✔ Endpoint: POST /test-connection
✔ Config API: POST /api/config/save
✔ Config API: GET /api/config/load
✔ Config API: DELETE /api/config/clear
✔ Config file: D:\ONEDRIVE\Documentos\INT5\config\app-config.json

==================================================
```

---

### Verificar Versión de Node

```bash
node --version
```

**Salida esperada**:
```
v18.17.0
```

---

### Ejecutar Script Node

```bash
node -e "console.log(process.env.ENCRYPTION_SECRET)"
```

**Descripción**: Ejecuta código JavaScript directamente. Útil para verificar variables de entorno.

---

## Comandos PowerShell (Windows)

### Verificar Conectividad de Red

```powershell
Test-Connection -ComputerName server -Count 1
```

**Descripción**: Prueba conectividad ping a un servidor.

**Salida esperada**:
```
Source        Destination     IPV4Address      IPV6Address  Bytes    Time(ms)
------        -----------     -----------      -----------  -----    --------
LAPTOP-ABC    server          192.168.1.100                 32       15
```

---

### Listar Carpetas Compartidas SMB

```powershell
net view \\server
```

**Descripción**: Lista todas las carpetas compartidas en un servidor SMB.

**Salida esperada**:
```
Shared resources at \\server

Share name        Type  Used as  Comment
-----------       ----  -------  -------
new               Disk           
IPC$              IPC            
ADMIN$            Disk           

The command completed successfully.
```

---

### Montar Carpeta SMB sin Credenciales

```powershell
net use \\server\share
```

**Descripción**: Conecta a una carpeta compartida sin autenticación.

**Salida esperada**:
```
The command completed successfully.
```

**Error posible**:
```
System error 5 has occurred.

Access is denied.
```

---

### Montar Carpeta SMB con Credenciales

```powershell
net use \\server\share /user:domain\username password
```

**Descripción**: Conecta a una carpeta compartida con usuario y contraseña.

**Ejemplo**:
```powershell
net use \\Laptop-fjiolk7l\new /user:client client123
```

**Salida esperada**:
```
The command completed successfully.
```

---

### Desmontar Carpeta SMB

```powershell
net use \\server\share /delete
```

**Descripción**: Desconecta una carpeta compartida.

**Salida esperada**:
```
\\server\share was deleted successfully.
```

**Forzar desconexión**:
```powershell
net use \\server\share /delete /y
```

---

### Listar Archivos en Carpeta SMB

```powershell
dir \\server\share\folder
```

**Descripción**: Lista archivos en una carpeta compartida.

**Salida esperada**:
```
 Directory of \\server\share\folder

01/15/2026  10:30 AM    <DIR>          .
01/15/2026  10:30 AM    <DIR>          ..
01/15/2026  09:45 AM           1,024   file1.csv
01/15/2026  10:15 AM           2,048   file2.csv
               2 File(s)          3,072 bytes
               2 Dir(s)  1,000,000,000 bytes free
```

---

### Listar Archivos CSV Específicamente

```powershell
dir \\server\share\folder\*.csv
```

**Descripción**: Lista solo archivos CSV en una carpeta.

**Salida esperada**:
```
 Directory of \\server\share\folder

01/15/2026  09:45 AM           1,024   file1.csv
01/15/2026  10:15 AM           2,048   file2.csv
               2 File(s)          3,072 bytes
```

---

### Leer Contenido de Archivo

```powershell
type \\server\share\folder\file.csv
```

**Descripción**: Muestra el contenido de un archivo.

**Salida esperada**:
```
Name,Age,City
John,30,NYC
Jane,25,LA
```

---

### Leer Archivo con Encoding UTF-8

```powershell
Get-Content -Path \\server\share\folder\file.csv -Encoding UTF8
```

**Descripción**: Lee archivo especificando encoding.

---

### Contar Líneas en Archivo

```powershell
(Get-Content \\server\share\folder\file.csv | Measure-Object -Line).Lines
```

**Descripción**: Cuenta el número de líneas en un archivo.

**Salida esperada**:
```
131
```

---

### Buscar Patrón en Archivo

```powershell
Select-String -Path \\server\share\folder\file.csv -Pattern "MedicationName"
```

**Descripción**: Busca líneas que coincidan con un patrón.

**Salida esperada**:
```
file.csv:1:MedicationName,Dosage,Route
```

---

### Ejecutar Comando cmd desde PowerShell

```powershell
cmd /c "comando aqui"
```

**Descripción**: Ejecuta comando de cmd.exe desde PowerShell.

**Ejemplo**:
```powershell
cmd /c "net use \\server\share /user:domain\username password && dir \\server\share"
```

---

### Redirigir Salida a Null

```powershell
comando >nul 2>&1
```

**Descripción**: Silencia completamente la salida (stdout y stderr).

**Ejemplo**:
```powershell
net use \\server\share /delete /y >nul 2>&1
```

---

### Encadenar Comandos

```powershell
comando1 & comando2 & comando3
```

**Descripción**: Ejecuta comandos secuencialmente.

**Ejemplo**:
```powershell
net use \\server\share /delete /y >nul 2>&1 & net use \\server\share /user:domain\username password >nul 2>&1 & dir \\server\share
```

---

## Comandos de Generación de Secretos

### Generar Secreto Aleatorio (Linux/Mac)

```bash
openssl rand -hex 32
```

**Descripción**: Genera un secreto aleatorio de 64 caracteres (256 bits).

**Salida esperada**:
```
40e0122509f06d8ff649ff0366fa0e98702dac8f587110a0f1b4051aec0d0fd2
```

---

### Generar Secreto en PowerShell

```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Descripción**: Genera secreto aleatorio en PowerShell.

**Salida esperada**:
```
QOABJQn/BtjfZJ/wNm+g6XgtrI9YcRCg8bQFGuwND/I=
```

---

## Comandos de Testing de Conexión

### Test 1: Verificar Conectividad Básica

```powershell
# Paso 1: Verificar que el servidor está accesible
Test-Connection -ComputerName Laptop-fjiolk7l -Count 1

# Paso 2: Ver carpetas compartidas
net view \\Laptop-fjiolk7l

# Paso 3: Intentar acceso sin credenciales
dir \\Laptop-fjiolk7l\new

# Paso 4: Si falla, intentar con credenciales
net use \\Laptop-fjiolk7l\new /user:client client123
dir \\Laptop-fjiolk7l\new

# Paso 5: Desmontar
net use \\Laptop-fjiolk7l\new /delete /y
```

**Qué verificar**:
- ✓ Server responde a ping
- ✓ Carpeta existe y es visible
- ✓ Acceso sin credenciales (si es público)
- ✓ Acceso con credenciales (si requiere autenticación)

---

### Test 2: Verificar Archivo CSV

```powershell
# Paso 1: Listar archivos CSV
dir \\Laptop-fjiolk7l\new\*.csv

# Paso 2: Contar líneas
(Get-Content \\Laptop-fjiolk7l\new\w.csv | Measure-Object -Line).Lines

# Paso 3: Ver primeras líneas
Get-Content \\Laptop-fjiolk7l\new\w.csv -TotalCount 5

# Paso 4: Verificar encoding
[System.IO.File]::ReadAllText("\\Laptop-fjiolk7l\new\w.csv") | Get-Member
```

**Qué verificar**:
- ✓ Archivo existe
- ✓ Número de líneas
- ✓ Contenido legible
- ✓ Encoding correcto

---

### Test 3: Verificar Patrón Wildcard

```powershell
# Patrón: *.csv
dir \\Laptop-fjiolk7l\new\*.csv

# Patrón: w*.csv
dir \\Laptop-fjiolk7l\new\w*.csv

# Patrón: data_*.csv
dir \\Laptop-fjiolk7l\new\data_*.csv

# Contar coincidencias
(dir \\Laptop-fjiolk7l\new\*.csv).Count
```

**Qué verificar**:
- ✓ Patrón coincide con archivos
- ✓ Solo un archivo coincide (si es requerido)
- ✓ Archivo correcto es seleccionado

---

## Comandos de Debugging

### Verificar Variables de Entorno

```bash
# En Linux/Mac
echo $ENCRYPTION_SECRET

# En PowerShell
$env:ENCRYPTION_SECRET
```

**Descripción**: Verifica que la variable de entorno esté configurada.

---

### Ver Contenido de .env

```bash
cat backend/.env
```

**Descripción**: Muestra el contenido del archivo .env.

**Salida esperada**:
```
ENCRYPTION_SECRET=40e0122509f06d8ff649ff0366fa0e98702dac8f587110a0f1b4051aec0d0fd2
```

---

### Ver Configuración Guardada

```bash
cat config/app-config.json
```

**Descripción**: Muestra la configuración guardada (con credenciales encriptadas).

**Salida esperada**:
```json
{
  "connection": {
    "connectorType": "networkPath",
    "path": "\\\\Laptop-fjiolk7l\\new",
    "fileNamePattern": "*.csv",
    "useAuthentication": true,
    "username": "client",
    "password": "enc:v1:aes-gcm:aBcDeFgHiJkLmN==:xYzAbCdEfGhIjKlMnOpQrStUvWxYz==",
    "useDomain": false,
    "domain": ""
  }
}
```

---

### Ver Logs del Servidor

```bash
# Si el servidor está corriendo en otra terminal
# Presiona Ctrl+C para ver los logs

# O busca en el archivo de logs si existe
tail -f server.log
```

**Descripción**: Muestra los logs más recientes del servidor.

---

### Verificar Puerto 3000 en Uso

```bash
# Linux/Mac
lsof -i :3000

# PowerShell (Windows)
netstat -ano | findstr :3000
```

**Descripción**: Verifica qué proceso está usando el puerto 3000.

**Salida esperada**:
```
node.exe             1234  LISTENING
```

---

### Matar Proceso en Puerto 3000

```bash
# Linux/Mac
kill -9 $(lsof -t -i :3000)

# PowerShell (Windows)
Stop-Process -Id 1234 -Force
```

**Descripción**: Detiene el proceso que usa el puerto 3000.

---

### Ver Estructura de Archivos

```bash
# Árbol completo
tree

# Solo archivos JS
find . -name "*.js" -type f

# Solo archivos en backend
ls -la backend/

# Solo archivos en src/js
ls -la src/js/
```

---

### Verificar Integridad de Archivos

```bash
# Contar líneas en archivo
wc -l backend/network-path-handler-windows.js

# Buscar función específica
grep -n "async detect" backend/network-path-handler-windows.js

# Buscar en todos los archivos
grep -r "ENCRYPTION_SECRET" .
```

---

## Flujos Completos de Testing

### Flujo 1: Testing Completo de Conexión SMB

```powershell
# ========================================
# PASO 1: Verificar Conectividad Básica
# ========================================

# Ping al servidor
Test-Connection -ComputerName Laptop-fjiolk7l -Count 1

# Ver carpetas compartidas
net view \\Laptop-fjiolk7l

# ========================================
# PASO 2: Acceso sin Credenciales
# ========================================

# Intentar listar carpeta
dir \\Laptop-fjiolk7l\new

# Si funciona, es público
# Si falla con "Access is denied", requiere credenciales

# ========================================
# PASO 3: Acceso con Credenciales
# ========================================

# Montar con credenciales
net use \\Laptop-fjiolk7l\new /user:client client123

# Listar archivos
dir \\Laptop-fjiolk7l\new

# Listar solo CSV
dir \\Laptop-fjiolk7l\new\*.csv

# ========================================
# PASO 4: Verificar Archivo Específico
# ========================================

# Contar líneas
(Get-Content \\Laptop-fjiolk7l\new\w.csv | Measure-Object -Line).Lines

# Ver primeras 5 líneas
Get-Content \\Laptop-fjiolk7l\new\w.csv -TotalCount 5

# Buscar columna específica
Select-String -Path \\Laptop-fjiolk7l\new\w.csv -Pattern "MedicationName"

# ========================================
# PASO 5: Desmontar
# ========================================

net use \\Laptop-fjiolk7l\new /delete /y

# ========================================
# RESULTADO ESPERADO
# ========================================
# ✓ Ping exitoso
# ✓ Carpeta visible
# ✓ Acceso con credenciales exitoso
# ✓ Archivos CSV visibles
# ✓ Archivo específico accesible
# ✓ Contenido legible
```

---

### Flujo 2: Testing del Backend

```bash
# ========================================
# PASO 1: Verificar Configuración
# ========================================

# Ver variables de entorno
echo $ENCRYPTION_SECRET

# Ver contenido de .env
cat backend/.env

# ========================================
# PASO 2: Instalar Dependencias
# ========================================

npm install

# ========================================
# PASO 3: Iniciar Servidor
# ========================================

node server.js

# Debería ver:
# ✔ Server running on port 3000
# ✔ Endpoint: POST /test-connection
# ✔ Config API: POST /api/config/save
# ✔ Config API: GET /api/config/load
# ✔ Config API: DELETE /api/config/clear

# ========================================
# PASO 4: Testing de Endpoints (en otra terminal)
# ========================================

# Test Connection
curl -X POST http://localhost:3000/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "path": "\\\\Laptop-fjiolk7l\\new",
    "pattern": "*.csv",
    "username": "client",
    "password": "client123"
  }'

# Load Config
curl http://localhost:3000/api/config/load

# ========================================
# PASO 5: Ver Logs
# ========================================

# En la terminal del servidor, deberías ver:
# [API] Reading file from: \\Laptop-fjiolk7l\new
# [LOG] Decrypting password...
# [CredentialCrypto] Decryption error: ...
# [LOG] Error: Failed to decrypt credential: ...
```

---

### Flujo 3: Testing del Frontend

```bash
# ========================================
# PASO 1: Verificar Secreto en HTML
# ========================================

# Buscar CSV_INT_LOCAL_SECRET
grep -n "CSV_INT_LOCAL_SECRET" src/pages/csv-integration.html

# Debe estar igual que en backend/.env

# ========================================
# PASO 2: Abrir en Navegador
# ========================================

# Abrir en navegador
# http://localhost:3000/src/pages/csv-integration.html

# ========================================
# PASO 3: Abrir Developer Tools (F12)
# ========================================

# Console tab
# Debería ver:
# [ConfigLoader] Attempting to load from backend API...
# [ConfigLoader] No configuration found in backend

# ========================================
# PASO 4: Test Connection
# ========================================

# 1. Ingresa Path: \\Laptop-fjiolk7l\new
# 2. Ingresa Pattern: *.csv
# 3. Ingresa Username: client
# 4. Ingresa Password: client123
# 5. Click "Test Connection"

# Debería ver en Console:
# [NetworkPathClient] Testing connection...
# [NetworkPathClient] Response received
# ✓ File loaded successfully
# ✓ Best delimiter detected: ',' (22 columns)
# ✓ STATUS: VALID

# ========================================
# PASO 5: Save Configuration
# ========================================

# Click "Save Configuration"

# Debería ver:
# [CSVIntegration] Saving configuration...
# SAVE: SAVED

# ========================================
# PASO 6: Verificar Configuración Guardada
# ========================================

# En otra terminal:
cat config/app-config.json

# Debería ver password encriptado:
# "password": "enc:v1:aes-gcm:..."
```

---

### Flujo 4: Debugging de Errores Comunes

```powershell
# ========================================
# ERROR: Access is denied
# ========================================

# Causa: Credenciales incorrectas o usuario sin permisos

# Test:
net use \\server\share /user:domain\username password

# Si falla:
# 1. Verificar username
# 2. Verificar password
# 3. Verificar que usuario tiene permisos en carpeta
# 4. Verificar que carpeta está compartida

# ========================================
# ERROR: The network path was not found
# ========================================

# Causa: Ruta SMB incorrecta o servidor no accesible

# Test:
Test-Connection -ComputerName server
net view \\server

# Si falla:
# 1. Verificar nombre del servidor (usar IP si es necesario)
# 2. Verificar que servidor está encendido
# 3. Verificar conectividad de red
# 4. Verificar firewall

# ========================================
# ERROR: File not found
# ========================================

# Causa: Patrón no coincide con archivos

# Test:
dir \\server\share\*.csv
dir \\server\share\w*.csv

# Si no hay resultados:
# 1. Verificar patrón wildcard
# 2. Verificar que archivos existen
# 3. Verificar extensión correcta

# ========================================
# ERROR: Decryption failed
# ========================================

# Causa: ENCRYPTION_SECRET no coincide

# Test:
echo $ENCRYPTION_SECRET
cat backend/.env

# Si no coinciden:
# 1. Actualizar backend/.env
# 2. Actualizar src/pages/csv-integration.html
# 3. Actualizar src/pages/index.html
# 4. Reiniciar servidor

# ========================================
# ERROR: Port 3000 already in use
# ========================================

# Causa: Otro proceso usa puerto 3000

# Test:
netstat -ano | findstr :3000

# Solución:
Stop-Process -Id <PID> -Force
```

---

## Resumen de Comandos por Categoría

### Git
| Comando | Propósito |
|---------|----------|
| `git status` | Ver estado |
| `git pull origin main` | Descargar cambios |
| `git push origin main` | Subir cambios |
| `git add -A` | Agregar cambios |
| `git commit -m "msg"` | Hacer commit |
| `git log --oneline -10` | Ver historial |

### Node.js
| Comando | Propósito |
|---------|----------|
| `npm install` | Instalar dependencias |
| `node server.js` | Iniciar servidor |
| `node --version` | Ver versión |

### PowerShell
| Comando | Propósito |
|---------|----------|
| `Test-Connection` | Verificar conectividad |
| `net view` | Ver carpetas compartidas |
| `net use` | Montar carpeta |
| `dir` | Listar archivos |
| `type` | Leer archivo |
| `Get-Content` | Leer contenido |

### Testing
| Comando | Propósito |
|---------|----------|
| `curl -X POST` | Testing de endpoints |
| `grep` | Buscar en archivos |
| `find` | Encontrar archivos |
| `wc -l` | Contar líneas |

---

## Tips de Debugging

1. **Siempre verificar conectividad básica primero**
   ```powershell
   Test-Connection -ComputerName server
   ```

2. **Usar rutas UNC correctas**
   ```
   ✓ Correcto:   \\server\share\folder
   ✗ Incorrecto: \server\share\folder
   ✗ Incorrecto: //server/share/folder
   ```

3. **Silenciar comandos cuando sea necesario**
   ```powershell
   comando >nul 2>&1
   ```

4. **Verificar ENCRYPTION_SECRET coincide**
   ```bash
   echo $ENCRYPTION_SECRET
   cat backend/.env
   grep CSV_INT_LOCAL_SECRET src/pages/csv-integration.html
   ```

5. **Ver logs del servidor en tiempo real**
   ```
   Mantener terminal con "node server.js" abierta
   Ver Console en Developer Tools (F12)
   ```

6. **Usar curl para testing de endpoints**
   ```bash
   curl -X POST http://localhost:3000/test-connection \
     -H "Content-Type: application/json" \
     -d '{"path":"...","pattern":"...","username":"...","password":"..."}'
   ```

7. **Desmontar siempre después de testing**
   ```powershell
   net use \\server\share /delete /y
   ```

---

## Comandos Rápidos (Copy-Paste)

### Verificar Todo Está Bien

```bash
# 1. Git status
git status

# 2. Ver secreto
echo $ENCRYPTION_SECRET

# 3. Instalar dependencias
npm install

# 4. Iniciar servidor
node server.js
```

### Testing Rápido de SMB

```powershell
# 1. Ping
Test-Connection -ComputerName Laptop-fjiolk7l -Count 1

# 2. Ver carpetas
net view \\Laptop-fjiolk7l

# 3. Listar CSV
dir \\Laptop-fjiolk7l\new\*.csv

# 4. Montar con credenciales
net use \\Laptop-fjiolk7l\new /user:client client123

# 5. Leer archivo
type \\Laptop-fjiolk7l\new\w.csv

# 6. Desmontar
net use \\Laptop-fjiolk7l\new /delete /y
```

### Testing Rápido de Endpoints

```bash
# Test Connection
curl -X POST http://localhost:3000/test-connection \
  -H "Content-Type: application/json" \
  -d '{"path":"\\\\Laptop-fjiolk7l\\new","pattern":"*.csv","username":"client","password":"client123"}'

# Load Config
curl http://localhost:3000/api/config/load

# Clear Config
curl -X DELETE http://localhost:3000/api/config/clear
```

---

## Notas Importantes

- ✓ Todos los comandos han sido probados en la sesión actual
- ✓ Los comandos PowerShell son específicos para Windows
- ✓ Los comandos bash funcionan en Linux/Mac
- ✓ Reemplazar valores de ejemplo con tus valores reales
- ✓ Siempre verificar conectividad básica primero
- ✓ Desmontar carpetas después de testing
- ✓ Mantener ENCRYPTION_SECRET sincronizado
