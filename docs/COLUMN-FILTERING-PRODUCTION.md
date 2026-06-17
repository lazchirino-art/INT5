# INT5 - Column Filtering in Production

> 📌 **Estado (2026-06-18):** documento de referencia. La fuente de verdad actualizada es **[INT5-DOCUMENTACION-TECNICA.md](INT5-DOCUMENTACION-TECNICA.md)**, con **[API-ENDPOINT.md](API-ENDPOINT.md)** (contrato) y **[DESPLIEGUE-KIOSCO.md](DESPLIEGUE-KIOSCO.md)** (despliegue). Novedad importante: en el flujo **CSV** ya no existe el checkbox *Include* (todas las columnas del Parser se exponen); el filtrado de campos por *Include* solo aplica en **API-RESP**.

## 📋 Tabla de Contenidos

1. [Concepto Fundamental](#concepto-fundamental)
2. [Flujo de Configuración](#flujo-de-configuración)
3. [Flujo de Producción](#flujo-de-producción)
4. [Formato de Datos](#formato-de-datos)
5. [Ejemplos Prácticos](#ejemplos-prácticos)
6. [Verificación](#verificación)
7. [Troubleshooting](#troubleshooting)

---

## Concepto Fundamental

### El Principio

**La configuración del Parser define exactamente qué columnas retornar en producción.**

```
┌─────────────────────────────────────────────────────────┐
│ TESTING (Parser Tab)                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Usuario configura "Expected Columns":                  │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Column Name  │ Index │ Data Type                 │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ MedicationName│   0   │ String                    │   │
│ │ Code         │   1   │ String                    │   │
│ │ Price        │   4   │ Number                    │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Preview muestra SOLO estas 3 columnas                 │
│ (aunque el archivo tiene 22)                          │
│                                                         │
│ Click "Save Configuration"                            │
│ ↓ Guarda en config/app-config.json                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ PRODUCCIÓN (API Endpoints)                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ POST /api/product/search                              │
│ {"productId":"ASP001","searchColumnIndex":1}          │
│                                                         │
│ Backend:                                               │
│ 1. Carga config/app-config.json                       │
│ 2. Lee archivo SMB (22 columnas)                      │
│ 3. Busca "ASP001" en columna 1                        │
│ 4. Encuentra fila: [Aspirin, ASP001, 500mg, ...]    │
│ 5. FILTRA por configuración:                          │
│    - Toma índice 0 → "Aspirin"                        │
│    - Toma índice 1 → "ASP001"                         │
│    - Toma índice 4 → "5.99"                           │
│ 6. Retorna SOLO estas 3 columnas                      │
│                                                         │
│ Response:                                              │
│ {                                                      │
│   "found": true,                                       │
│   "product": {                                         │
│     "MedicationName": "Aspirin",                       │
│     "Code": "ASP001",                                 │
│     "Price": 5.99                                     │
│   }                                                    │
│ }                                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Flujo de Configuración

### Paso 1: Ingresar Columnas Esperadas

En la pestaña **Parser**, tabla **Expected Columns**:

```
┌─────────────────────────────────────────────────────────┐
│ Column Name    │ Index │ Data Type                      │
├─────────────────────────────────────────────────────────┤
│ MedicationName │   0   │ String                         │
│ Code           │   1   │ String                         │
│ Dosage         │   2   │ String                         │
│ Price          │   4   │ Number                         │
│ ExpiryDate     │  10   │ Date                           │
└─────────────────────────────────────────────────────────┘
```

**Importante**:
- **Column Name**: Nombre que aparecerá en la respuesta
- **Index**: Índice en el archivo CSV (0-based)
- **Data Type**: Tipo de dato (String, Number, Date)

### Paso 2: Click "Check Configuration"

- Lee el archivo
- Valida que los índices existen
- Muestra preview con SOLO las columnas configuradas

### Paso 3: Click "Save Configuration"

- Guarda en `config/app-config.json`:

```json
{
  "parser": {
    "delimiter": ",",
    "hasHeader": true,
    "quoteChar": "\"",
    "escapeChar": "\"",
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
        "name": "Price",
        "index": 4,
        "dataType": "Number"
      },
      {
        "name": "ExpiryDate",
        "index": 10,
        "dataType": "Date"
      }
    ]
  }
}
```

---

## Flujo de Producción

### Búsqueda Simple

```bash
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ASP001",
    "searchColumnIndex": 1
  }'
```

### Backend Process

```javascript
// 1. Cargar configuración
const config = JSON.parse(readFileSync(CONFIG_FILE));
const parserConfig = config.parser;

// 2. Leer archivo (22 columnas)
const fileContent = await handler.readFile(...);

// 3. Parsear CSV
const rows = csvUtils.parseCSVContent(
  fileContent,
  parserConfig.delimiter,
  parserConfig.hasHeader,
  ...
);

// 4. Buscar producto
const result = csvUtils.searchProductInRows(
  rows,
  "ASP001",
  1,
  parserConfig.columns  // ← Pasar columnas configuradas
);

// 5. rowToObject() filtra automáticamente
// Solo retorna las 5 columnas configuradas
```

### Response

```json
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Dosage": "500mg",
    "Price": 5.99,
    "ExpiryDate": "2025-12-31"
  },
  "rowIndex": 42,
  "totalRows": 131,
  "searchTime": 245
}
```

---

## Formato de Datos

### Conversión Automática

La función `formatValue()` aplica conversión según el tipo configurado:

| Data Type | Input | Output | Ejemplo |
|-----------|-------|--------|---------|
| **String** | Cualquier valor | Texto trimmed | `"Aspirin"` |
| **Number** | `"5.99"` | `5.99` (número) | `5.99` |
| **Number** | `"invalid"` | `"invalid"` (fallback) | `"invalid"` |
| **Date** | `"2025-12-31"` | `"2025-12-31"` | `"2025-12-31"` |
| **Date** | `"12/31/2025"` | `"2025-12-31"` | `"2025-12-31"` |
| **Date** | `"invalid"` | `"invalid"` (fallback) | `"invalid"` |

### Ejemplo de Conversión

```javascript
// Configuración
{
  "name": "Price",
  "index": 4,
  "dataType": "Number"
}

// Archivo CSV
"Aspirin,ASP001,500mg,Oral,5.99,Pharma1,..."

// Valor raw
"5.99"

// Después de formatValue()
5.99  // ← Convertido a número

// En response
{
  "Price": 5.99  // ← Tipo correcto
}
```

---

## Ejemplos Prácticos

### Ejemplo 1: Búsqueda Simple

**Configuración**:
```json
{
  "columns": [
    {"name": "MedicationName", "index": 0, "dataType": "String"},
    {"name": "Code", "index": 1, "dataType": "String"},
    {"name": "Price", "index": 4, "dataType": "Number"}
  ]
}
```

**Archivo CSV** (22 columnas):
```
MedicationName,Code,Dosage,Route,Price,Supplier,Batch,Expiry,...
Aspirin,ASP001,500mg,Oral,5.99,Pharma1,B123,2025-12,...
```

**Request**:
```bash
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{"productId":"ASP001","searchColumnIndex":1}'
```

**Response**:
```json
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Price": 5.99
  },
  "rowIndex": 0,
  "totalRows": 131,
  "searchTime": 245
}
```

**¿Qué pasó?**
- ✅ Buscó en columna 1 (Code)
- ✅ Encontró "ASP001"
- ✅ Retornó SOLO las 3 columnas configuradas
- ✅ Convirtió Price a número
- ❌ NO retornó Dosage, Route, Supplier, Batch, Expiry, etc.

---

### Ejemplo 2: Búsqueda Avanzada

**Request**:
```bash
curl -X POST http://localhost:3000/api/product/search-advanced \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "columnIndex": 4,
      "value": "5.99",
      "operator": "equals"
    }
  }'
```

**Response**:
```json
{
  "found": true,
  "product": {
    "MedicationName": "Aspirin",
    "Code": "ASP001",
    "Price": 5.99
  },
  "rowIndex": 0,
  "totalRows": 131,
  "searchTime": 123
}
```

---

### Ejemplo 3: Múltiples Búsquedas

**Request**:
```bash
curl -X POST http://localhost:3000/api/product/search-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": ["ASP001", "IBU002", "ACE003"],
    "searchColumnIndex": 1
  }'
```

**Response**:
```json
{
  "found": true,
  "products": [
    {
      "found": true,
      "product": {
        "MedicationName": "Aspirin",
        "Code": "ASP001",
        "Price": 5.99
      },
      "rowIndex": 0
    },
    {
      "found": true,
      "product": {
        "MedicationName": "Ibuprofen",
        "Code": "IBU002",
        "Price": 3.99
      },
      "rowIndex": 15
    },
    {
      "found": true,
      "product": {
        "MedicationName": "Acetaminophen",
        "Code": "ACE003",
        "Price": 2.99
      },
      "rowIndex": 42
    }
  ],
  "totalFound": 3,
  "totalRows": 131,
  "searchTime": 456
}
```

---

### Ejemplo 4: Obtener Todos

**Request**:
```bash
curl -X GET http://localhost:3000/api/product/all
```

**Response**:
```json
{
  "products": [
    {
      "product": {
        "MedicationName": "Aspirin",
        "Code": "ASP001",
        "Price": 5.99
      },
      "rowIndex": 0
    },
    {
      "product": {
        "MedicationName": "Ibuprofen",
        "Code": "IBU002",
        "Price": 3.99
      },
      "rowIndex": 1
    },
    ...
  ],
  "totalFound": 131,
  "totalRows": 131,
  "searchTime": 1234
}
```

---

## Verificación

### Verificar Configuración Guardada

```bash
curl -X GET http://localhost:3000/api/config/load
```

**Response**:
```json
{
  "status": "SUCCESS",
  "config": {
    "connection": {...},
    "parser": {
      "delimiter": ",",
      "hasHeader": true,
      "columns": [
        {"name": "MedicationName", "index": 0, "dataType": "String"},
        {"name": "Code", "index": 1, "dataType": "String"},
        {"name": "Price", "index": 4, "dataType": "Number"}
      ]
    }
  }
}
```

### Verificar Columnas en Response

Busca un producto y verifica:

```bash
curl -X POST http://localhost:3000/api/product/search \
  -H "Content-Type: application/json" \
  -d '{"productId":"ASP001","searchColumnIndex":1}' | jq '.product | keys'
```

**Output esperado**:
```json
[
  "MedicationName",
  "Code",
  "Price"
]
```

**¿Qué significa?**
- ✅ Response tiene SOLO 3 columnas
- ✅ Son las configuradas
- ✅ En el orden correcto
- ❌ NO tiene Dosage, Route, Supplier, etc.

---

## Troubleshooting

### Problema 1: Response tiene todas las columnas

**Causa**: Configuración no se guardó correctamente.

**Solución**:
1. Verificar `config/app-config.json` existe
2. Verificar que tiene `parser.columns`
3. Volver a guardar Parser config

---

### Problema 2: Orden de columnas incorrecto

**Causa**: El orden en Expected Columns no se respeta.

**Solución**:
1. Verificar orden en `config.parser.columns`
2. Debe ser el mismo que en la tabla
3. Volver a guardar si es necesario

---

### Problema 3: Tipos de datos incorrectos

**Causa**: Data Type no se aplicó correctamente.

**Solución**:
1. Verificar `dataType` en configuración
2. Debe ser "String", "Number", o "Date"
3. Volver a guardar Parser config

---

### Problema 4: Índices fuera de rango

**Causa**: Índice configurado no existe en el archivo.

**Solución**:
1. Verificar índices en Expected Columns
2. Deben ser válidos para el archivo
3. Usar "Check Configuration" para validar

---

## Resumen

| Aspecto | Detalles |
|--------|----------|
| **Configuración** | Define qué columnas retornar |
| **Orden** | Respeta orden de Expected Columns |
| **Índices** | Usa índices configurados |
| **Tipos** | Aplica conversión de datos |
| **Filtrado** | Retorna SOLO columnas configuradas |
| **Persistencia** | Guardado en config/app-config.json |
| **Producción** | Usado en todos los endpoints |

---

## Flujo End-to-End

```
1. Usuario configura Expected Columns
   ↓
2. Click "Save Configuration"
   ↓
3. Guarda en config/app-config.json
   ↓
4. Aplicación externa solicita búsqueda
   ↓
5. Backend carga config
   ↓
6. Lee archivo (todas las columnas)
   ↓
7. Busca producto
   ↓
8. Filtra por columnas configuradas
   ↓
9. Aplica tipos de datos
   ↓
10. Retorna SOLO columnas configuradas
```

---

¿Necesitas ayuda con algo más?
