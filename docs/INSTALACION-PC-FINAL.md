# INT5 — Guía de Instalación en la PC final

> Cómo instalar y dejar operativo INT5 en el equipo de destino (kiosco o PC de
> producción), desde cero. Incluye requisitos, dependencias y verificación.

Versión: 2026-06-18.

---

## 1. Requisitos del sistema

| Requisito | Detalle | ¿Obligatorio? |
|-----------|---------|---------------|
| **Sistema operativo** | **Windows 10 / 11 (64-bit)** | ✅ Sí — INT5 accede a recursos SMB con **PowerShell/cmd** de Windows. No funciona en Linux/Mac. |
| **Node.js** | **18 o superior** (recomendado **20 LTS**). Incluye `npm`. | ✅ Sí — el servidor necesita `fetch` nativo (Node 18+). |
| **Python** | — | ❌ **NO se necesita.** El proyecto es 100% Node.js. |
| **Compiladores / build tools** | — | ❌ **NO se necesitan.** Todas las dependencias son JavaScript puro (no hay módulos nativos / node-gyp). |
| **Navegador** | Chrome / Edge (o el WebView de la app de producción) | ✅ Para mostrar el wizard |
| **Hardware** | Doble núcleo, 4 GB RAM (recomendado 8 GB + SSD) | — |

> El consumo de INT5 es mínimo (~50–90 MB de RAM en reposo). El factor que más pesa es el tamaño del CSV (se lee entero en memoria por importación).

---

## 2. Dependencias del proyecto

Se instalan automáticamente con `npm install` (definidas en `package.json`):

| Paquete | Para qué |
|---------|----------|
| `express` | Servidor HTTP y endpoints |
| `cors` | Permitir llamadas desde la app de producción |
| `dotenv` | Leer `backend/.env` (secreto de cifrado) |
| `bonjour-service` | Descubrimiento mDNS (`int5.local`) |
| `smb2` | Dependencia declarada (el acceso real se hace por PowerShell) |

Todas son **JavaScript puro**: no requieren Visual Studio, ni Python, ni node-gyp.

---

## 3. Instalación paso a paso

### Paso 1 — Instalar Node.js
1. Descargar el instalador de **Node.js 20 LTS** desde <https://nodejs.org/>.
2. Instalar con las opciones por defecto.
3. Verificar en una terminal (cmd o PowerShell):
   ```
   node --version
   npm --version
   ```
   `node` debe ser **v18 o superior**.

### Paso 2 — Copiar el proyecto
1. Copiar la carpeta del proyecto al equipo, **fuera de OneDrive** (recomendado **`C:\INT5`**), para evitar conflictos de sincronización.
2. **No copiar** estas carpetas/archivos (no forman parte del producto): `old/`, `.claude/`, `node_modules/`, `.git/`. (Ver sección 7.)

### Paso 3 — Instalar dependencias
En una terminal, dentro de la carpeta del proyecto:
```
cd C:\INT5
npm install
```
Esto crea la carpeta `node_modules/` con las dependencias.

### Paso 4 — El secreto de cifrado (`backend/.env`)  ⚠️ leer con atención
El archivo **`backend/.env` SÍ se incluye** en esta entrega, así que **no hay que crear nada**: ya viene listo y funciona. Pero es importante que entiendas qué es y cómo afecta, por si en algún momento hay que reinstalar o cambiarlo.

**Contenido de `backend/.env`:**
```
ENCRYPTION_SECRET=40e0122509f06d8ff649ff0366fa0e98702dac8f587110a0f1b4051aec0d0fd2
PORT=3000
```

Ver la explicación completa del secreto en la **sección 9** de este documento.

> Regla de oro: el `ENCRYPTION_SECRET` del `.env` (backend) **debe ser idéntico** al `window.CSV_INT_LOCAL_SECRET` del frontend (en `src/pages/csv-integration.html` e `index.html`). En esta entrega ya coinciden. Si alguno se cambia y el otro no, las contraseñas guardadas dejan de descifrarse.

### Paso 5 — Arrancar el servidor
- **Manual (para probar):**
  ```
  node server.js
  ```
  o doble clic en **`iniciar.bat`** (arranca el servidor y abre el navegador).
- Debe mostrar `Server running on port 3000`.

### Paso 6 — Verificar
1. Abrir en el navegador: `http://localhost:3000`.
2. Debe verse el **menú** de INT5 (tema oscuro). El botón **CSV** abre el wizard.
3. (Opcional) Probar el flujo con la vista mock: `http://localhost:3000/mock-production.html`.

### Paso 7 — Arranque automático (kiosco / producción)
Para que INT5 arranque solo (oculto) al encender el equipo:
1. Click derecho en **`install-autostart.bat`** → **Ejecutar como administrador**.
2. Esto registra una tarea que ejecuta `start-int5.vbs` al iniciar sesión.
3. Para quitarlo: `uninstall-autostart.bat`.

Detalle del modelo de despliegue (kiosco, seguridad, cuenta de servicio) en **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)**.

---

## 4. Configuración inicial (primera vez)

Una vez instalado y arrancado, configurar el wizard una sola vez (ver **[FLUJO-DE-USO.md](FLUJO-DE-USO.md)**):
Connector → Parser → Mapping → Validation → Persistence, guardando cada pestaña.

La configuración se guarda en `config/app-config.json`.

---

## 5. Verificación final (smoke test)

- [ ] `node --version` ≥ 18
- [ ] `npm install` sin errores → existe `node_modules/`
- [ ] `backend/.env` creado con `ENCRYPTION_SECRET` correcto
- [ ] `node server.js` muestra "Server running on port 3000"
- [ ] `http://localhost:3000` carga el menú
- [ ] Test Connection del Connector → READY (con el recurso SMB accesible)
- [ ] Importación de prueba desde `mock-production.html` → IMPORTED / NOT_FOUND

---

## 6. Notas y red

- **Puerto:** 3000 (configurable con `PORT` en `.env`). En el kiosco todo es local (`localhost`), no requiere abrir el firewall.
- **Acceso desde otro dispositivo** (opcional): `http://int5.local:3000` o `http://IP-del-equipo:3000` (requiere permitir el puerto 3000 en el firewall de Windows).
- **OneDrive:** no instalar el proyecto dentro de OneDrive en el equipo final.

---

## 7. Qué NO incluir en la entrega

Estas carpetas/archivos **no forman parte del producto** y no deben copiarse al equipo final:

| Elemento | Motivo |
|----------|--------|
| `old/` | Archivos legacy/basura archivados |
| `.claude/` | Herramientas de desarrollo (no es del proyecto) |
| `node_modules/` | Se regenera con `npm install` |
| `.git/` | Historial de versiones (no necesario en producción) |
| `gen-docx.cjs` | Generador del Word (herramienta de desarrollo) |
| `mock-api-server.js`, `iniciar-mock.bat` | Solo para pruebas de API-RESP (no parte de la entrega CSV) |

> `backend/.env` **SÍ se incluye** en esta entrega (contiene el secreto de cifrado). No hay que crearlo a mano. Ver la sección 9.

---

## 8. Problemas frecuentes

| Síntoma | Causa / solución |
|---------|------------------|
| `'node' no se reconoce` | Node.js no instalado o no en el PATH → reinstalar Node y reabrir la terminal. |
| `EADDRINUSE :3000` | Ya hay un INT5 corriendo en el puerto 3000 → cerrar la instancia anterior. |
| Las contraseñas no descifran / SMB falla con credenciales correctas | El `ENCRYPTION_SECRET` del `.env` no coincide con el del frontend → corregir y volver a guardar el Connector. |
| "La carpeta requiere credenciales" con auth desmarcado | Comportamiento correcto: el recurso del cliente exige credenciales → activar Authentication. |
| El servidor no arranca solo al encender | Ejecutar `install-autostart.bat` como administrador. |

---

## 9. El secreto de cifrado, en detalle (IMPORTANTE)

### 9.1. Qué problema resuelve
En el **Connector** se guarda un **usuario y contraseña** para acceder a la carpeta de red del cliente. No queremos guardar esa contraseña en texto plano en `config/app-config.json` (cualquiera que abriera el archivo la vería). Por eso la contraseña se **cifra** (se vuelve ilegible) antes de guardarse. En el archivo aparece así:
```json
"password": "enc:v1:aes-gcm:tODZTkGHXVOJhNZS:RKSWkdyk+YHiq04nhHm1GraD9UANG6Xfuw=="
```
Eso es la contraseña cifrada con **AES-GCM**.

### 9.2. El secreto = la llave
Para cifrar y descifrar hace falta una **llave**, derivada de un **secreto** (una cadena larga). En este proyecto el secreto es:
```
40e0122509f06d8ff649ff0366fa0e98702dac8f587110a0f1b4051aec0d0fd2
```

**Analogía:** es la combinación de un candado. Con esa combinación se **cierra** (cifra) la contraseña y con la **misma** combinación se **abre** (descifra). Otra combinación no abre.

### 9.3. Por qué el secreto está en DOS sitios (y deben coincidir)
El cifrado ocurre en dos momentos:

| Momento | Quién | Dónde está el secreto |
|---------|-------|----------------------|
| **Al guardar** el Connector (navegador) | Frontend **cifra** la contraseña | `src/pages/csv-integration.html` e `index.html`, en `window.CSV_INT_LOCAL_SECRET` |
| **Al acceder al SMB** (servidor) | Backend **descifra** la contraseña | `backend/.env`, en `ENCRYPTION_SECRET` |

➡️ **Los dos valores tienen que ser idénticos.** Lo que el navegador cierra, el servidor solo lo abre con la misma llave. En esta entrega **ya coinciden** (el valor de arriba).

```
Frontend cifra con secreto A  →  guarda contraseña cifrada en app-config.json
Backend descifra con secreto A  →  ✅ accede al SMB
Backend descifra con secreto B  →  ❌ falla aunque la contraseña sea correcta
```

### 9.4. Nivel de seguridad real (honesto)
Como la llave está también en el **frontend** (en el HTML que se entrega), este cifrado sirve para que la contraseña **no se vea a simple vista** en `app-config.json` (protege de una mirada casual), **pero no protege** frente a alguien que tenga el código del proyecto (la llave está ahí mismo, en el HTML). Es **cifrado de ofuscación**, no seguridad fuerte. Incluir el `.env` en la entrega **no expone nada nuevo**, porque el secreto ya viaja en el HTML.

### 9.5. Si alguna vez cambias el secreto
1. Cambia el valor en **los dos sitios** (`.env` y los HTML) por el mismo valor nuevo.
2. **Vuelve a guardar la configuración del Connector** (la contraseña se re-cifra con la llave nueva). Las contraseñas guardadas con la llave anterior dejarán de descifrarse.

### 9.6. Mejora futura (no aplica a esta entrega)
Para seguridad de verdad, habría que **sacar el secreto del frontend** y dejarlo solo en el backend (`.env`), rediseñando cómo se cifran las credenciales. Es una mejora para más adelante; para esta entrega el esquema actual es suficiente.
