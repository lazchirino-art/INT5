const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak
} = require('docx');

const CONTENT_W = 9360;        // US Letter, 1" margins
const MONO = "Consolas";

// ---- helpers --------------------------------------------------------------
const H = (text, level) => new Paragraph({ heading: level, children: [new TextRun(text)] });
const P = (text) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun(text)] });
const Pruns = (runs) => new Paragraph({ spacing: { after: 120 }, children: runs });
const B = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun(text)] });

function code(lines) {
  return new Paragraph({
    spacing: { before: 60, after: 120 },
    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
    border: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
    },
    children: lines.flatMap((l, i) => {
      const r = new TextRun({ text: l, font: MONO, size: 18 });
      return i === 0 ? [r] : [new TextRun({ break: 1, text: l, font: MONO, size: 18 })];
    }),
  });
}

function table(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const margins = { top: 60, bottom: 60, left: 110, right: 110 };
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders, margins, width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: "2E75B6", type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })] })],
    })),
  });
  const dataRows = rows.map(cells => new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders, margins, width: { size: widths[i], type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 20 })] })],
    })),
  }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...dataRows] });
}

// ---- document -------------------------------------------------------------
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: "1F3864" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: "2E75B6" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
  ]},
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "INT5 — Documentación Técnica   ·   ", size: 16, color: "888888" }),
                 new TextRun({ text: "Página ", size: 16, color: "888888" }),
                 new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" })],
    })] }) },
    children: [
      // Cover
      new Paragraph({ spacing: { before: 2400, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "INT5", bold: true, size: 72, color: "1F3864" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Documentación Técnica", size: 40, color: "2E75B6" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Módulo de integración de productos (CSV / API-REST)", size: 24, color: "555555" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [new TextRun({ text: "Versión: 2026-06-18", size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Estado: módulo CSV cerrado tras testing", size: 22, color: "555555" })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // TOC
      H("Índice", HeadingLevel.HEADING_1),
      new TableOfContents("Tabla de contenido", { hyperlink: true, headingStyleRange: "1-2" }),
      new Paragraph({ children: [new PageBreak()] }),

      // 1
      H("1. Propósito", HeadingLevel.HEADING_1),
      P("INT5 es un servicio backend (no es la aplicación que usa el operador). Resuelve el problema de integrar catálogos de productos de distintos clientes, cada uno con su propio formato de archivo o API, sin reprogramar: todo se configura mediante un asistente (wizard) de 5 pasos y queda guardado."),
      P("Hay dos integraciones independientes, cada una con su wizard de 5 pestañas:"),
      B("CSV — lee un archivo CSV desde un recurso compartido de red (SMB)."),
      B("API-RESP — consume un endpoint REST externo que devuelve el producto en JSON."),

      // 2
      H("2. Tecnologías utilizadas", HeadingLevel.HEADING_1),
      table(["Capa", "Tecnología"], [
        ["Runtime backend", "Node.js (módulos ESM)"],
        ["Servidor HTTP", "Express (puerto 3000)"],
        ["Acceso SMB", "PowerShell/cmd vía child_process"],
        ["Cifrado de credenciales", "AES-GCM (Web Crypto / crypto de Node)"],
        ["Descubrimiento en red", "bonjour-service (mDNS — int5.local)"],
        ["Frontend", "HTML + CSS + JavaScript vanilla (sin frameworks)"],
        ["Persistencia", "Archivos JSON locales"],
        ["API-RESP", "fetch nativo de Node (v18+)"],
        ["Dependencias npm", "express, cors, dotenv, bonjour-service, smb2"],
      ], [2800, 6560]),

      // 3
      H("3. Arquitectura", HeadingLevel.HEADING_1),
      P("INT5 y la aplicación de producción corren en el mismo equipo (un kiosco). La app de producción muestra la interfaz al operador; cuando hace falta, embebe el wizard de INT5 (vía localhost:3000) y le pide datos por HTTP."),
      code([
        "┌──────────────── KIOSCO (un equipo) ────────────────┐",
        "│  App de producción (pantalla completa, login operador)│",
        "│    ├─ botón \"Integración\" → abre localhost:3000 (wizard)│",
        "│    └─ importar producto   → POST /api/product/import   │",
        "│                                                       │",
        "│  INT5 (servicio oculto, :3000)                        │",
        "│    ├─ sirve el wizard y los endpoints                  │",
        "│    └─ lee CSV en red (SMB) o consume API REST externa  │",
        "└───────────────────────────────────────────────────────┘",
      ]),
      H("Dos momentos distintos", HeadingLevel.HEADING_2),
      B("Configuración (una vez, al instalar): un técnico recorre el wizard de 5 pestañas y guarda. Se persiste en config/app-config.json."),
      B("Operación (a diario): la app de producción llama a POST /api/product/import. INT5 busca, valida, devuelve y registra en el log."),

      // 4
      H("4. Estructura de archivos", HeadingLevel.HEADING_1),
      code([
        "INT5/",
        "├── server.js                  # Express + endpoints",
        "├── backend/",
        "│   ├── network-path-handler-windows.js  # Acceso SMB (test + lectura)",
        "│   ├── credential-crypto.js   # Descifrado AES-GCM",
        "│   ├── csv-utils.js           # Parseo CSV + búsqueda + rowToObject",
        "│   ├── local-db.js            # Sync log + caché de productos",
        "│   └── api-resp-handler.js    # Cliente HTTP API-RESP",
        "├── config/app-config.json     # Configuración persistida",
        "├── data/                       # sync-log.json + products.json",
        "├── src/pages/                  # index, csv-integration, api-resp-integration",
        "├── src/js/                     # UI de cada tab",
        "├── mock-api-server.js          # Mock (:3001) para probar API-RESP",
        "├── start-int5.vbs              # Arranque oculto (kiosco)",
        "└── install-autostart.bat       # Registra el arranque automático",
      ]),

      // 5
      H("5. Flujo de configuración (wizard)", HeadingLevel.HEADING_1),
      H("CSV", HeadingLevel.HEADING_2),
      table(["Tab", "Nombre", "Qué configura"], [
        ["1", "Connector", "Ruta SMB, patrón de archivo, autenticación. Test Connection detecta el archivo."],
        ["2", "Parser", "Delimitador, header, columnas (nombre + índice + tipo). Check valida y muestra preview."],
        ["3", "Mapping", "Asigna a cada columna un JSON tag (nombre de salida)."],
        ["4", "Validation", "Marca campos requeridos (rechaza producto con ese campo vacío)."],
        ["5", "Persistence", "Modo de trigger (auto/manual) y nivel de validación. Muestra el Sync Log."],
      ], [700, 1700, 6960]),
      H("API-RESP", HeadingLevel.HEADING_2),
      table(["Tab", "Diferencia respecto a CSV"], [
        ["1 Connector", "URL base, path, método (GET/POST), auth (none / API Key / Bearer / Basic)"],
        ["2 Response Schema", "Se pega/obtiene un JSON de ejemplo y se auto-detectan los campos"],
        ["3 Mapping", "Igual, pero SÍ incluye checkbox Include (el schema trae todos los campos)"],
        ["4 Validation / 5 Persistence", "Igual que CSV"],
      ], [2400, 6960]),
      H("Carga automática", HeadingLevel.HEADING_2),
      P("Toda la configuración se guarda por sección (cada tab guarda solo la suya) y se recarga automáticamente al volver a abrir cada pestaña. Solo si se reconfigura el Connector/Parser conviene verificar y volver a guardar la cadena (Mapping/Validation), porque dependen de las columnas."),

      // 6
      H("6. Endpoints", HeadingLevel.HEADING_1),
      P("El contrato completo (request/response) está en API-ENDPOINT.md. Resumen:"),
      table(["Endpoint", "Uso"], [
        ["POST /api/config/save", "Guarda una sección de config (merge con el resto)"],
        ["GET /api/config/load", "Devuelve la config completa"],
        ["DELETE /api/config/clear", "Borra la config (con backup)"],
        ["POST /test-connection", "Prueba SMB y detecta el archivo (Tab 1 CSV)"],
        ["POST /api/product/import", "Endpoint principal CSV — busca, valida, importa, registra"],
        ["POST /api/product/import-api", "Endpoint principal API-RESP"],
        ["POST /api/apiResp/test-connection", "Prueba la API externa y detecta campos"],
        ["GET /api/sync-log", "Historial de importaciones (paginado, append-only)"],
        ["POST /api/product/search*, filter, /all, /stats", "Consultas directas al CSV"],
      ], [4200, 5160]),

      // 7
      H("7. Lógica de negocio", HeadingLevel.HEADING_1),
      H("Merge de configuración", HeadingLevel.HEADING_2),
      P("Cada tab envía solo su sección a /api/config/save. El backend la mezcla con la existente (no pisa las demás). Secciones: connection, parser, mapping, validation, persistence, apiResp."),
      H("loadProductionContext()", HeadingLevel.HEADING_2),
      P("Helper compartido por los endpoints de producto CSV: valida la config, descifra la contraseña SMB, lee el archivo del recurso y parsea las filas."),
      H("Modos de trigger (Persistence)", HeadingLevel.HEADING_2),
      B("Auto — busca, valida e importa silenciosamente en cada llamada."),
      B("Manual — la primera llamada devuelve CONFIRMATION_REQUIRED (sin log, sin caché); solo se importa al reenviar con confirmed: true."),
      H("Nivel de validación (solo modo Manual)", HeadingLevel.HEADING_2),
      P("persistence.validationLevel: \"superior\" → la app de producción pide login de un usuario/supervisor superior; \"same\" → basta un botón \"verificado por el mismo operador\". Se devuelve en la respuesta CONFIRMATION_REQUIRED."),
      H("Validación de campos requeridos", HeadingLevel.HEADING_2),
      P("Si un campo marcado como requerido viene vacío → se rechaza con VALIDATION_FAILED y el mensaje \"Product found in CSV but with incomplete data — field [X] is empty\"."),
      H("Mapeo e índice de columna", HeadingLevel.HEADING_2),
      P("El Column Index del Parser selecciona qué columna del archivo se lee; el JSON tag del Mapping es el nombre de salida. En CSV todas las columnas configuradas se exponen (no hay Include); en API-RESP el Include permite elegir entre los campos auto-detectados."),
      H("Sync Log", HeadingLevel.HEADING_2),
      P("Cada intento de importación se registra en data/sync-log.json (append-only). Cada entrada incluye:"),
      code([
        "{",
        "  \"timestamp\": \"...\", \"productCode\": \"ASP001\", \"result\": \"FOUND\",",
        "  \"requestedBy\": \"operador.juan\",",
        "  \"confirmedBy\": \"supervisor.ana\",",
        "  \"fields\": { \"code\": \"ASP001\", \"name\": \"Aspirina 100mg\" },",
        "  \"error\": \"\"",
        "}",
      ]),
      B("result: FOUND | NOT_FOUND | VALIDATION_FAILED | ERROR."),
      B("fields: valores de cada columna configurada (no un contador). null si no hay producto; parcial en VALIDATION_FAILED."),
      B("requestedBy / confirmedBy: identidad del operador, enviada por la app de producción (INT5 no gestiona usuarios)."),
      B("El paso CONFIRMATION_REQUIRED no se registra (aún no es una acción completada)."),

      // 8
      H("8. Seguridad", HeadingLevel.HEADING_1),
      H("Cifrado de credenciales", HeadingLevel.HEADING_2),
      P("La contraseña SMB se guarda cifrada en app-config.json con AES-GCM (formato enc:v1:aes-gcm:...). El secreto está en backend/.env (ENCRYPTION_SECRET) y en el frontend (window.CSV_INT_LOCAL_SECRET). Quien tenga acceso al .env puede descifrarla — es lo esperado en este diseño."),
      H("Identidad de Windows y acceso SMB", HeadingLevel.HEADING_2),
      P("Con el authenticator desmarcado, INT5 accede al recurso con la identidad de Windows del proceso (el usuario bajo el que corre el servidor), no de forma anónima. Si ese usuario ya tiene acceso (o el recurso es público) → entra; si el recurso exige credenciales que no tiene → deniega (la app muestra \"la carpeta requiere credenciales\")."),
      P("En el kiosco el usuario de Windows es admin local pero ajeno al dominio del cliente, así que sobre el recurso del cliente es un desconocido → sin credenciales, deniega. Por eso la seguridad funciona sin configuración extra."),
      Pruns([ new TextRun({ text: "int5svc es solo una herramienta de pruebas en desarrollo", bold: true }),
              new TextRun(" para simular el entorno restringido en una máquina con SSO/admin. No se usa en el kiosco. Ver DESPLIEGUE-KIOSCO.md.") ]),

      // 9
      H("9. Persistencia de datos", HeadingLevel.HEADING_1),
      table(["Archivo", "Contenido"], [
        ["config/app-config.json", "Configuración de los wizards (todas las secciones)"],
        ["data/sync-log.json", "Array append-only de entradas de log (más reciente primero al leer)"],
        ["data/products.json", "Caché { productCode: { ...datos, _updatedAt } }"],
      ], [3200, 6160]),

      // 10
      H("10. Despliegue", HeadingLevel.HEADING_1),
      P("Resumen (detalle en DESPLIEGUE-KIOSCO.md):"),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Copiar al kiosco la carpeta de INT5 (idealmente fuera de OneDrive, ej. C:\\INT5) y el software de producción.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Ejecutar install-autostart.bat una vez (como administrador) → INT5 arranca oculto al iniciar sesión.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("La app de producción abre localhost:3000 para mostrar el wizard y llama a los endpoints enviando requestedBy/confirmedBy.")] }),

      // 11
      H("11. Limitaciones y notas conocidas", HeadingLevel.HEADING_1),
      B("El connector no se re-testea automáticamente al cargar: tras reabrir, hay que probar/guardar la conexión para habilitar el Check del Parser si se reconfigura."),
      B("El descifrado de credenciales depende del ENCRYPTION_SECRET; debe conservarse el mismo entre frontend y backend."),
      B("El sync log nunca se purga (crece indefinidamente); a futuro conviene una política de rotación/archivado."),
      B("Pruebas de seguridad en desarrollo: requieren ejecutar el servidor bajo una cuenta restringida (int5svc) para reproducir el comportamiento del kiosco."),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("docs/INT5-DOCUMENTACION-TECNICA.docx", buf);
  console.log("OK: docs/INT5-DOCUMENTACION-TECNICA.docx");
});
