# INT5 — Guía de Despliegue (Kiosco)

> Cómo instalar y arrancar INT5 en el equipo de producción (kiosco), bajo qué
> usuario debe correr, y cómo probar el comportamiento de seguridad en desarrollo.

---

## 1. Modelo de despliegue

INT5 y la aplicación de producción corren en **el mismo equipo** (kiosco):

- El kiosco arranca, la app de producción toma toda la pantalla; el operador no accede a Windows.
- El **login del operador** es del software (nivel aplicación), **distinto** del usuario de Windows.
- INT5 corre **oculto en segundo plano** en `localhost:3000`.
- La app de producción muestra el wizard de INT5 (embebido vía `localhost:3000`) cuando hace falta, y le pide datos por HTTP.

```
Encender kiosco
   │
   ├── Windows inicia sesión (usuario fijo del kiosco, admin LOCAL)
   │
   ├── INT5 arranca oculto (start-int5.vbs / tarea automática)  →  localhost:3000
   │
   └── App de producción arranca a pantalla completa
          ├── botón "Integración"  → muestra http://localhost:3000
          └── importar producto     → POST localhost:3000/api/product/import
```

---

## 2. Instalación (una vez)

1. **Copiar** al kiosco:
   - La carpeta de INT5 (recomendado **fuera de OneDrive**, p.ej. `C:\INT5`, para evitar conflictos de sincronización).
   - El software de producción.
2. Tener **Node.js** instalado en el kiosco.
3. Instalar dependencias (una vez): abrir cmd en la carpeta y `npm install`.
4. Registrar el arranque automático:
   - Click derecho en **`install-autostart.bat`** → **Ejecutar como administrador**.
   - Esto crea una tarea que ejecuta `start-int5.vbs` al iniciar sesión.
5. (Opcional) Arrancar ya sin reiniciar: doble clic en **`start-int5.vbs`**.

Para quitar el arranque automático: `uninstall-autostart.bat` (como administrador).

### Dos opciones de arranque (elige una)

| Opción | Cómo | Cuándo |
|--------|------|--------|
| **A** | La app de producción lanza INT5 al iniciarse (proceso hijo) | Si el equipo de producción prefiere controlar el arranque. **No** instalar la tarea. |
| **B** | `install-autostart.bat` (tarea al iniciar sesión) | INT5 arranca independiente de la app. |

> ⚠️ No usar ambas a la vez: arrancarían dos instancias y chocarían en el puerto 3000.

---

## 3. Bajo qué usuario corre INT5 (seguridad)

INT5 hereda la **identidad de Windows del proceso** para acceder a los recursos SMB. Esto determina si el "auth desmarcado" entra o deniega.

### En el kiosco
El usuario del kiosco es **admin LOCAL**, pero **no** es admin del dominio del cliente. Punto clave:

> Ser admin local **solo** da poder sobre la propia máquina. Sobre el recurso compartido del cliente (en la red del cliente), el kiosco es **un desconocido**.

Por tanto, al acceder a la carpeta protegida del cliente **sin credenciales**, el servidor del cliente **deniega**. El comportamiento de seguridad ("auth desmarcado → requiere credenciales") funciona **sin configuración extra**. No hace falta crear ninguna cuenta especial en el kiosco.

El acceso real al CSV del cliente se hará normalmente **con credenciales** (authenticator con usuario/contraseña que dé el cliente), o sin ellas si la carpeta es pública. Ambos casos están soportados.

---

## 4. Probar la seguridad en desarrollo (cuenta `int5svc`)

En una PC de desarrollo el usuario suele ser admin y/o tener una **cuenta Microsoft** que provoca **SSO automático** con otras máquinas de la red. Eso hace que el "auth desmarcado" entre solo, y **no** refleja el comportamiento del kiosco.

Para reproducir el entorno restringido del kiosco y validar el comportamiento, se ejecuta el servidor bajo una **cuenta local restringida** llamada `int5svc`:

```bat
:: 1. Crear la cuenta (cmd como administrador)
net user int5svc Int5Svc_2026! /add

:: 2. Darle acceso solo a la carpeta del proyecto (para leer el código y escribir config/data)
icacls "C:\ruta\al\proyecto\INT5" /grant int5svc:(OI)(CI)M

:: 3. Arrancar el servidor como esa cuenta
runas /user:int5svc "cmd /k cd /d C:\ruta\al\proyecto\INT5 && node server.js"
```

> `runas` no muestra la contraseña mientras se escribe (campo en blanco) — teclear `Int5Svc_2026!` a ciegas y Enter. Si falla, verificar que el servicio "Secondary Logon" esté activo (`sc query seclogon`).

Con INT5 corriendo bajo `int5svc` (sin permisos sobre el recurso del cliente):

| Authenticator | Credenciales | Resultado esperado |
|---------------|--------------|--------------------|
| Desmarcado | — | ❌ "La carpeta requiere credenciales" |
| Marcado | usuario/contraseña válidos | ✅ Lee el archivo |
| Marcado | contraseña incorrecta | ❌ Authentication failed |

> **`int5svc` es solo para pruebas en desarrollo.** En el kiosco NO se usa: ahí INT5 corre bajo el usuario del kiosco, que ya es ajeno al cliente.

---

## 5. Contrato con el equipo de producción

1. INT5 corre como proceso oculto en `localhost:3000` en el mismo equipo.
2. Para mostrar el wizard: abrir/embeber `http://localhost:3000`.
3. Para importar: `POST http://localhost:3000/api/product/import` (CSV) o `/api/product/import-api` (API-RESP), enviando **`requestedBy`** (operador) y, al confirmar en modo manual, **`confirmedBy`**.
4. En modo Manual, la respuesta `CONFIRMATION_REQUIRED` incluye **`validationLevel`** (`"superior"` | `"same"`) → la app de producción decide si mostrar un login superior o un botón de auto-verificación.
5. INT5 no gestiona usuarios ni el arranque del kiosco — eso es responsabilidad de la app/instalación de producción.

Detalle de endpoints: **[API-ENDPOINT.md](API-ENDPOINT.md)**.
