# INT5 — Flujo de Uso (operador / pantalla)

> Cómo se usa INT5 paso a paso, desde el punto de vista de la **persona**: qué ve,
> qué hace, qué botones pulsa y qué resultado obtiene. Sin detalle técnico interno.
>
> Para el flujo **interno del software** (funciones/módulos) ver
> **[FLUJO-TECNICO.md](FLUJO-TECNICO.md)**. Visión global en
> **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**.

Versión: 2026-06-18.

---

## Quién hace qué

- **El técnico de instalación** configura una vez el wizard (las 5 pestañas) y guarda.
- **El operador de producción** (en el día a día) no toca el wizard: solo usa la app de producción, que importa productos por detrás.

```
Configurar (una vez)                     Operar (a diario)
────────────────────                     ─────────────────
Connector → Parser → Mapping →           Escanear código en la app
Validation → Persistence                 → ver el producto / confirmar
(Guardar cada pestaña)                   → queda registrado en el log
```

---

## Configuración (wizard, una vez)

Abrir `http://localhost:3000` → botón **CSV**. Se recorren las 5 pestañas en orden.

### Pestaña 1 — Connector
1. Elegir **Network Path**.
2. Escribir la **ruta** del recurso (`\\servidor\carpeta`) y el **patrón** del archivo (`*.csv`).
3. Si la carpeta pide credenciales: marcar **Authentication** y poner usuario/contraseña (y dominio si aplica).
4. Pulsar **Test Connection**.
   - ✅ **READY** + nombre del archivo detectado → todo bien.
   - ❌ Mensaje de error (carpeta requiere credenciales, ruta no encontrada, etc.) → corregir y reintentar.
5. Con READY, pulsar **Save Configuration** → aparece **SAVE: SAVED**.

### Pestaña 2 — Parser
1. Elegir **delimitador** (`,`, `;`…) y **Has Header** (Sí/No).
2. Añadir las **columnas** que interesan: nombre, **índice** (qué columna del archivo) y tipo.
   - Con Has Header = No, los nombres se ponen solos (Column0, Column1…).
3. Pulsar **Check Configuration** → aparece un **preview** con los datos.
4. Si el preview es correcto, pulsar **Save** → **STATUS: SAVED**.

### Pestaña 3 — Mapping
1. Se cargan solas las columnas del Parser.
2. Para cada una, escribir el **JSON Tag** (el nombre con el que saldrá el dato).
3. Elegir la **Search Column**: la columna que contiene el **código** que buscará producción.
4. Pulsar **Save Mapping** → **MAPPING: SAVED**.

### Pestaña 4 — Validation
1. Se cargan los campos mapeados.
2. Marcar como **Required** los campos obligatorios (sin ellos, el producto se rechaza).
3. Pulsar **Save** → **VALIDATION: SAVED**.

### Pestaña 5 — Persistence
1. Elegir **Trigger Mode**:
   - **Auto** → importa directo, sin preguntar.
   - **Manual** → pide confirmación antes de importar. Si eliges Manual, aparece **Validation Level**:
     - **Superior** → la confirmación pedirá un login de supervisor.
     - **Mismo nivel** → bastará un botón de "verificado por el operador".
2. Pulsar **Save** → **PERSISTENCE: SAVED**.
3. Abajo está el **Sync Log**: el historial de importaciones (al principio vacío).

> Una vez guardado todo, cada vez que se entra al wizard aparece lo configurado. Solo si se cambia el Connector/Parser conviene revisar y volver a guardar Mapping y Validation.

---

## Operación (día a día)

El operador trabaja en la **app de producción**, no en el wizard. Por cada producto:

1. **Escanea / escribe el código** del producto.
2. La app pregunta a INT5 y, según el resultado, muestra:
   - ✅ **Producto importado** → muestra los datos del producto.
   - 🔍 **No encontrado** → el código no está en el archivo.
   - ✗ **Datos incompletos** → falta un campo obligatorio.
3. Si la configuración es **Manual**, antes de importar aparece una **ventana de confirmación**:
   - **Validación superior** → se pide usuario/contraseña de un **supervisor**.
   - **Mismo nivel** → solo un botón **"Verificado por [operador]"**.
   - Al confirmar, se importa.
4. Cada operación queda registrada en el **log** (fecha, código, resultado, quién lo hizo y quién validó, y los datos importados).

> La vista `mock-production.html` reproduce este flujo de operación para pruebas.

---

## Consultar el historial

- En el wizard, pestaña **Persistence → Sync Log**: tabla con todas las importaciones (fecha, código, resultado, solicitado por, confirmado por, campos, error).
- Nunca se borra: sirve de auditoría de qué se importó y quién lo hizo.

---

## Resumen visual

```
ESCANEAR CÓDIGO
   │
   ├─ Auto  ───────────────→ Importado ✅ / No encontrado 🔍 / Incompleto ✗
   │
   └─ Manual → ventana de confirmación
                 ├─ Superior     → login supervisor → Importado ✅
                 └─ Mismo nivel  → botón verificar  → Importado ✅
   │
   └────────────────────────→ queda en el Sync Log (auditoría)
```
