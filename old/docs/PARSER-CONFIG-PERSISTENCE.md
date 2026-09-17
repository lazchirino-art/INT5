# INT5 - Parser Configuration Persistence

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Novedades recientes: el desplegable Has Header ahora restaura correctamente "No" al cargar; los nombres auto de columna son consecutivos por posición (Column0, Column1…) y el índice solo selecciona la columna del archivo; el preview respeta el Column Index; el Save del Parser actualiza la etiqueta de estado.

## 📋 Tabla de Contenidos

1. [Problema Identificado](#problema-identificado)
2. [Solución Implementada](#solución-implementada)
3. [Flujo de Guardado](#flujo-de-guardado)
4. [Flujo de Producción](#flujo-de-producción)
5. [Estructura de Configuración](#estructura-de-configuración)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Problema Identificado

### ❌ Antes (Incorrecto)

La configuración del Parser se guardaba **solo en localStorage del navegador**:

```javascript
// parser-ui.js (ANTES)
localStorage.setItem('menuCsvInt.parserConfig', JSON.stringify(config));
```

**Problemas**:
1. ❌ No persiste en el backend
2. ❌ No está disponible en producción
3. ❌ No se puede usar en endpoints de búsqueda
4. ❌ Cada navegador tiene su propia copia
5. ❌ Se pierde si se limpia localStorage

---

## Solución Implementada

### ✅ Después (Correcto)

La configuración del Parser se guarda **en el backend** (`config/app-config.json`):

```javascript
// parser-ui.js (DESPUÉS)
const response = await fetch('/api/config/save', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(config)
});
```

**Beneficios**:
1. ✅ Persiste en el backend
2. ✅ Disponible en producción
3. ✅ Se usa en endpoints de búsqueda
4. ✅ Centralizado en un solo lugar
5. ✅ Compartido entre todos los usuarios

---

## Flujo de Guardado

### Fase 1: Testing (Connector Tab)

```
Usuario configura conexión SMB
        ↓
Click "Test Connection"
        ↓
Backend verifica acceso
        ↓
Click "Save Configuration"
        ↓
POST /api/config/save
{
  "connection": {
    "path": "\\\\server\\share",
    "username": "client",
    "password": "enc:v1:aes-gcm:...",
    "filename": "w.csv"
  }
}
        ↓
Backend guarda en config/app-config.json
{
  "connection": {...},
  "parser": {}
}
```

### Fase 2: Testing (Parser Tab)

```
Usuario configura columnas esperadas
        ↓
Click "Check Configuration"
        ↓
Backend lee archivo usando connection config
        ↓
Frontend valida columnas
        ↓
Click "Save Configuration"
        ↓
POST /api/config/save
{
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "quoteChar": "\"",
    "escapeChar": "\"",
    "columns": [
      {"name": "MedicationName", "index": 0, "dataType": "String"},
      {"name": "Code", "index": 1, "dataType": "String"},
      {"name": "Dosage", "index": 2, "dataType": "String"}
    ]
  }
}
        ↓
Backend MERGE con config existente
        ↓
config/app-config.json actualizado
{
  "connection": {...},
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "columns": [...]
  }
}
```

---

## Flujo de Producción

### Búsqueda de Producto

```
Aplicación externa
        ↓
POST /api/product/search
{"productId": "ASP001", "searchColumnIndex": 1}
        ↓
Backend carga config/app-config.json
        ↓
Extrae connection config
        ↓
Extrae parser config
        ↓
Desencripta contraseña
        ↓
Lee archivo SMB
        ↓
Parsea con delimitador guardado
        ↓
Busca en columnas guardadas
        ↓
Retorna resultado
```

### Código en Endpoints de Producción

```javascript
// Cargar configuración completa
const configData = readFileSync(CONFIG_FILE, 'utf-8');
const config = JSON.parse(configData);

const connectorConfig = config.connection;  // De Connector tab
const parserConfig = config.parser;         // De Parser tab

// Usar parser config para parsear
const rows = csvUtils.parseCSVContent(
  fileContent,
  parserConfig.delimiter,      // ← De config guardada
  parserConfig.hasHeader,       // ← De config guardada
  parserConfig.quoteChar,       // ← De config guardada
  parserConfig.escapeChar       // ← De config guardada
);

// Buscar en columnas guardadas
const result = csvUtils.searchProductInRows(
  rows,
  productId,
  searchColumnIndex,
  parserConfig.columns.map(c => c.name)  // ← De config guardada
);
```

---

## Estructura de Configuración

### config/app-config.json (Completo)

```json
{
  "connection": {
    "path": "\\\\Laptop-fjiolk7l\\new",
    "filename": "w.csv",
    "username": "client",
    "password": "enc:v1:aes-gcm:aBcDeFgHiJkLmN==:xYzAbCdEfGhIjKlMnOpQrStUvWxYz==",
    "domain": null,
    "useAuthentication": true
  },
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "quoteChar": "\"",
    "escapeChar": "\"",
    "dateFormat": "",
    "decimalSeparator": "",
    "emptyValue": "",
    "columns": [
      {
        "name": "MedicationName",
        "index": 0,
        "dataType": "String"
      },
      {
        "name": "Code",
        "index": 1,
        "dataType": "String"
      },
      {
        "name": "Dosage",
        "index": 2,
        "dataType": "String"
      },
      {
        "name": "Route",
        "index": 3,
        "dataType": "String"
      },
      {
        "name": "Price",
        "index": 4,
        "dataType": "Number"
      }
    ]
  }
}
```

### Desglose

| Sección | Origen | Uso |
|---------|--------|-----|
| `connection` | Connector Tab | Acceso a SMB |
| `connection.path` | Usuario | Ruta SMB |
| `connection.username` | Usuario | Autenticación |
| `connection.password` | Usuario (encriptada) | Autenticación |
| `parser.delimiter` | Auto-detectado | Parsing CSV |
| `parser.hasHeader` | Usuario | Parsing CSV |
| `parser.columns` | Usuario | Validación y búsqueda |
| `parser.columns[].index` | Usuario | Índice de columna |
| `parser.columns[].name` | Usuario | Nombre de columna |

---

## Testing

### Test 1: Guardar Configuración del Parser

```bash
# Paso 1: Configurar Connector
curl -X POST http://localhost:3000/api/config/save \
  -H "Content-Type: application/json" \
  -d '{
    "connection": {
      "path": "\\\\Laptop-fjiolk7l\\new",
      "filename": "w.csv",
      "username": "client",
      "password": "enc:v1:aes-gcm:...",
      "useAuthentication": true
    }
  }'

# Paso 2: Configurar Parser
curl -X POST http://localhost:3000/api/config/save \
  -H "Content-Type: application/json" \
  -d '{
    "parser": {
      "delimiter": ",",
      "hasHeader": true,
      "quoteChar": "\"",
      "escapeChar": "\"",
      "columns": [
        {"name": "MedicationName", "index": 0, "dataType": "String"},
        {"name": "Code", "index": 1, "dataType": "String"},
        {"name": "Dosage", "index": 2, "dataType": "String"}
      ]
    }
  }'

# Paso 3: Verificar configuración guardada
curl -X GET http://localhost:3000/api/config/load
```

**Resultado esperado**:
```json
{
  "status": "SUCCESS",
  "config": {
    "connection": {...},
    "parser": {...}
  }
}
```

---

### Test 2: Usar Configuración en Producción

```bash
# Búsqueda usando configuración guardada
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{"productId":"ASP001","searchColumnIndex":1}'
```

**Resultado esperado**:
```json
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Dosage": "500mg",
    "Route": "Oral",
    "Price": "5.99"
  },
  "rowIndex": 42,
  "totalRows": 131,
  "searchTime": 245
}
```

---

### Test 3: Verificar Índices de Columnas

```bash
# Buscar en columna específica
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ASP001",
    "searchColumnIndex": 1
  }'

# Buscar en otra columna
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "Aspirin",
    "searchColumnIndex": 0
  }'
```

---

## Troubleshooting

### Problema 1: "Configuration is not valid"

**Causa**: El Parser no ha sido validado antes de guardar.

**Solución**:
1. Click "Check Configuration" en Parser tab
2. Esperar validación
3. Luego click "Save Configuration"

---

### Problema 2: "Error saving configuration"

**Causa**: El backend no está disponible o hay error en la configuración.

**Solución**:
1. Verificar que servidor está corriendo: `node server.js`
2. Verificar logs del servidor
3. Revisar que JSON sea válido

---

### Problema 3: Búsqueda no encuentra productos

**Causa**: Parser config no se guardó correctamente o índices son incorrectos.

**Solución**:
1. Verificar `config/app-config.json`
2. Verificar que `parser.columns` tiene índices correctos
3. Verificar que `parser.delimiter` es correcto
4. Volver a guardar Parser config

---

### Problema 4: Columnas no coinciden

**Causa**: Los índices guardados no corresponden a las columnas reales del archivo.

**Solución**:
1. Abrir Parser tab
2. Click "Check Configuration"
3. Revisar preview
4. Ajustar índices si es necesario
5. Click "Save Configuration"

---

## Flujo Completo (Testing → Producción)

```
┌─────────────────────────────────────────────────────────┐
│ FASE 1: TESTING                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. Connector Tab                                        │
│    └─ Ingresar credenciales                            │
│    └─ Click "Test Connection"                          │
│    └─ Click "Save Configuration"                       │
│    └─ Guarda en config.connection                      │
│                                                         │
│ 2. Parser Tab                                           │
│    └─ Ingresar columnas esperadas                      │
│    └─ Click "Check Configuration"                      │
│    └─ Revisar preview                                  │
│    └─ Click "Save Configuration"                       │
│    └─ Guarda en config.parser                          │
│                                                         │
│ Resultado: config/app-config.json completo             │
│ {                                                       │
│   "connection": {...},                                 │
│   "parser": {...}                                      │
│ }                                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ FASE 2: PRODUCCIÓN                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. Aplicación externa solicita búsqueda                │
│    └─ POST /api/product/search                         │
│                                                         │
│ 2. Backend carga config/app-config.json                │
│    └─ Lee connection config                            │
│    └─ Lee parser config                                │
│                                                         │
│ 3. Backend desencripta credenciales                    │
│    └─ Accede a SMB                                     │
│    └─ Lee archivo                                      │
│                                                         │
│ 4. Backend parsea con config guardada                  │
│    └─ Usa delimiter guardado                           │
│    └─ Usa hasHeader guardado                           │
│    └─ Usa columnas guardadas                           │
│                                                         │
│ 5. Backend busca producto                              │
│    └─ Usa índices guardados                            │
│    └─ Retorna resultado                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Resumen de Cambios

| Componente | Antes | Después |
|-----------|-------|---------|
| **Almacenamiento** | localStorage | config/app-config.json |
| **Disponibilidad** | Solo frontend | Frontend + Backend |
| **Producción** | No disponible | Disponible |
| **Persistencia** | Por navegador | Global |
| **Compartido** | No | Sí |

---

## Próximos Pasos

1. ✅ Guardar Connector config
2. ✅ Guardar Parser config
3. ✅ Usar en endpoints de producción
4. ⏳ Testing completo
5. ⏳ Documentación de usuario

¿Necesitas ayuda con algo más?
