# Instalación Completa — INT5

**Para usuarios sin Node.js instalado.**

---

## Paso 1: Instalar Node.js

1. Ve a [https://nodejs.org/](https://nodejs.org/)
2. Descarga la versión **LTS**
3. Ejecuta el instalador `.msi` → Next → Next → Install → Finish
4. Verifica en PowerShell:
   ```powershell
   node --version
   npm --version
   ```
   Deberías ver versiones (ej: `v20.11.0` / `10.2.4`)

---

## Paso 2: Habilitar ejecución de scripts en PowerShell

Abre PowerShell **como Administrador** y ejecuta:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Responde `Y`.

---

## Paso 3: Obtener el proyecto

### Opción A — Con Git

```powershell
git clone https://github.com/lazchirino-art/INT5.git
cd INT5
```

### Opción B — Sin Git (descarga ZIP)

```powershell
Invoke-WebRequest -Uri "https://github.com/lazchirino-art/INT5/archive/refs/heads/main.zip" -OutFile "INT5.zip"
Expand-Archive -Path "INT5.zip" -DestinationPath "."
cd INT5-main
```

---

## Paso 4: Instalar dependencias

```powershell
npm install
```

Espera hasta ver: `added XXX packages in XXs`

---

## Paso 5: Configurar variable de entorno de cifrado

Crea el archivo `backend/.env` con el siguiente contenido:

```
ENCRYPTION_SECRET=una-clave-aleatoria-larga-y-segura
```

> ⚠️ Esta clave cifra las contraseñas guardadas en `config/app-config.json`.  
> Si la cambias, tendrás que volver a ingresar las contraseñas en el wizard.  
> **No subas este archivo al repositorio.**

Si el archivo no existe, el servidor arranca de todos modos pero no cifrará las credenciales.

---

## Paso 6: Configurar acceso por nombre `int5` (opcional, recomendado)

Para acceder con `http://int5:3000` en lugar de `http://localhost:3000`:

Abre PowerShell **como Administrador** y ejecuta:

```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "`n127.0.0.1`tint5" -Encoding utf8
```

Para acceso desde el **teléfono** (misma red WiFi), el mDNS (`http://int5.local:3000`) se anuncia automáticamente al iniciar el servidor. No requiere configuración adicional.

---

## Paso 7: Iniciar el servidor

```powershell
npm start
```

Salida esperada:

```
==================================================
Backend Server
==================================================

✔ Server running on port 3000
✔ Local:   http://localhost:3000
✔ mDNS:    http://int5.local:3000  ← PC y teléfono (misma red)
✔ Network: http://192.168.x.x:3000  [Wi-Fi]
✔ Endpoint: POST /test-connection
✔ Config API: POST /api/config/save
✔ Config API: GET /api/config/load
✔ Product API: POST /api/product/import
✔ Sync Log:    GET /api/sync-log
...
==================================================
```

> **No cierres esta terminal.** El servidor necesita estar corriendo.

---

## Paso 8: Abrir la aplicación

Abre tu navegador en: `http://localhost:3000`

Verás el menú principal. Haz click en **CSV** (sección Integraciones).

---

## Paso 9: Configurar el wizard (5 tabs en orden)

### Tab 1 — Connector

| Campo | Descripción |
|-------|-------------|
| Connection Type | Selecciona **Network Path** |
| Path | Ruta UNC: `\\servidor\compartida\carpeta` |
| File Name Pattern | Ej: `medications_*.csv` |
| Authentication | Marcar si la carpeta requiere usuario/contraseña |
| Domain | Marcar si el usuario pertenece a un dominio Windows |

1. Haz click en **Test Connection**
2. Si aparece **STATUS: READY**, haz click en **Save Configuration**

### Tab 2 — Parser

1. Configura delimitador, encabezado y otros parámetros
2. Agrega las columnas esperadas (nombre + índice)
3. Usa **Check Configuration** para ver un preview del archivo real
4. Haz click en **Save Configuration**

### Tab 3 — Mapping

1. La tabla se rellena con las columnas del parser
2. Escribe el **JSON Tag** que verá el sistema externo (CORINA)
3. Desmarca **Include** para omitir columnas del response
4. Haz click en **Save Mapping**

### Tab 4 — Validation

1. La tabla se rellena con los campos incluidos en el mapping
2. Marca **Required** en campos obligatorios
3. Un campo requerido vacío rechaza el producto con mensaje al operador
4. Haz click en **Save Validation Rules**

### Tab 5 — Persistence

1. Elige el **Trigger Mode** (Auto o Manual)
2. Haz click en **Save Persistence Config**
3. El **Sync Log** se actualiza automáticamente con cada llamada a `/api/product/import`

---

## Paso 10: Verificar con una llamada de prueba

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/product/import" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"productCode":"ASP001","searchColumnIndex":0}'
```

O con curl:

```bash
curl -X POST http://localhost:3000/api/product/import \
  -H "Content-Type: application/json" \
  -d '{"productCode":"ASP001","searchColumnIndex":0}'
```

---

## Detener el servidor

En la terminal donde corre:

```
Ctrl + C
```

---

## Resumen de comandos

```powershell
# Instalar (solo una vez)
npm install

# Iniciar
npm start

# Detener
Ctrl + C
```

---

## Troubleshooting

| Error | Solución |
|-------|----------|
| `npm is not recognized` | Reinstala Node.js y reinicia PowerShell |
| `Port 3000 already in use` | `taskkill /F /IM node.exe` en CMD |
| `Cannot find path` en Test Connection | Verifica la ruta en File Explorer |
| Config no se carga al abrir la página | Vuelve a ingresar credenciales en Tab 1 y guarda |
| `Cannot GET /` | Verifica que el servidor está corriendo |
| Scripts deshabilitados | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |

---

Ver `docs/API-ENDPOINT.md` para la referencia completa de endpoints.
