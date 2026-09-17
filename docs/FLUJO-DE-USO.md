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
1. Elegir **Network Path** (SFTP aparece deshabilitado: aún no está disponible).
2. Escribir la **ruta** del recurso (`\\servidor\carpeta`) y el **patrón** del archivo (`*.csv`).
3. Si la carpeta pide credenciales: marcar **Authentication** y poner usuario/contraseña (y dominio si aplica).
4. Pulsar **Test Connection**.
   - ✅ **READY** + nombre del archivo detectado → todo bien.
   - ❌ Mensaje de error (usuario/contraseña incorrectos, cuenta bloqueada, acceso denegado, carpeta requiere credenciales, servidor no accesible, recurso no encontrado, etc.) → corregir y reintentar.
5. Con READY, pulsar **Save Configuration** → aparece **SAVE: SAVED** (también al volver a abrir el wizard). Si después se cambia cualquier campo, hay que volver a probar y guardar.

### Pestaña 2 — Parser
1. Elegir **delimitador** (`,`, `;`…) y **Has Header** (Sí/No). Si hace falta: separador decimal, formato de fecha (p. ej. `dd/MM/yyyy`) y valores que cuentan como vacíos (p. ej. `NULL, N/A`); producción los aplica al importar.
2. Añadir las **columnas** que interesan: nombre, **índice** (qué columna del archivo) y tipo.
   - Con Has Header = No, los nombres se ponen solos (Column0, Column1…).
3. Pulsar **Check Configuration** (requiere el Connector guardado) → aparece un **preview** con los datos.
   - Si el archivo usa otro delimitador distinto del elegido, el Check da **error** (FAILED): corregir el delimitador.
   - Si una fila no tiene el número de columnas esperado, el error indica qué fila es.
4. Si el Check es **VALID**, pulsar **Save** → **STATUS: SAVED**. (Save solo se habilita con VALID; si se editan, añaden o quitan columnas, hay que repetir el Check.)

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

> Una vez guardado todo, cada vez que se entra al wizard aparece lo configurado. Si se cambian las columnas del Parser o los tags del Mapping, Mapping y Validation muestran **OUTDATED — ... SAVE AGAIN**: hay que revisarlos y volver a guardarlos.

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
- No se borra: sirve de auditoría de qué se importó y quién lo hizo. Cuando el archivo supera 5 MB se guarda aparte (`data/sync-log.<fecha>.json`) y la tabla empieza un historial nuevo.

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
