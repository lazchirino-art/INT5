/**
 * mock-api-server.js — Servidor mock independiente para probar el wizard API-RESP.
 *
 * Arrancar: node mock-api-server.js
 * Puerto:   3001
 *
 * Endpoints disponibles:
 *   GET  /products/:code
 *   POST /products/lookup        body: { code }
 *   POST /products/lookup-auth   body: { code }  — requiere Authorization header
 *
 * Configuración en el wizard API-RESP:
 *   Base URL:  http://localhost:3001
 *   Path:      /products/{productCode}      (GET)
 *     o bien   /products/lookup             (POST)
 *   Auth:      None / Bearer / API Key — ver ejemplos abajo
 */

import http from 'http';

const PORT = 3001;

// ── Productos de ejemplo ───────────────────────────────────────────────────

const PRODUCTS = {
  'ASP001': {
    code:        'ASP001',
    name:        'Aspirina 100mg',
    description: 'Ácido acetilsalicílico 100mg comprimidos',
    category:    'Analgésico',
    laboratory:  'Bayer',
    price:       4.99,
    stock:       250,
    unit:        'caja x 20 comp.',
    barcode:     '7891234560011',
    expiry:      '2026-12-31',
    active:      true,
    details: {
      dose:      '100mg',
      route:     'oral',
      prescription: false
    }
  },
  'IBU200': {
    code:        'IBU200',
    name:        'Ibuprofeno 200mg',
    description: 'Ibuprofeno 200mg comprimidos recubiertos',
    category:    'Antiinflamatorio',
    laboratory:  'Ratiopharm',
    price:       6.50,
    stock:       180,
    unit:        'caja x 24 comp.',
    barcode:     '7891234560022',
    expiry:      '2027-03-15',
    active:      true,
    details: {
      dose:      '200mg',
      route:     'oral',
      prescription: false
    }
  },
  'AMO500': {
    code:        'AMO500',
    name:        'Amoxicilina 500mg',
    description: 'Amoxicilina 500mg cápsulas',
    category:    'Antibiótico',
    laboratory:  'GenericFarma',
    price:       12.80,
    stock:       90,
    unit:        'caja x 12 cáps.',
    barcode:     '7891234560033',
    expiry:      '2025-09-30',
    active:      true,
    details: {
      dose:      '500mg',
      route:     'oral',
      prescription: true
    }
  },
  'INCOMPLETE': {
    code:        'INCOMPLETE',
    name:        '',
    description: 'Producto con campos vacíos para probar validación',
    category:    '',
    laboratory:  'TestLab',
    price:       0,
    stock:       5,
    unit:        '',
    barcode:     '0000000000000',
    expiry:      '',
    active:      false,
    details: {
      dose:      '',
      route:     '',
      prescription: false
    }
  }
};

const VALID_BEARER = 'test-token-12345';
const VALID_API_KEY = 'mock-api-key-abc';

// ── Helpers ───────────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'*',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
  });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function lookupProduct(code) {
  const product = PRODUCTS[String(code).toUpperCase()] || PRODUCTS[code];
  return product || null;
}

function checkAuth(req, type) {
  if (type === 'bearer') {
    const auth = req.headers['authorization'] || '';
    return auth === `Bearer ${VALID_BEARER}`;
  }
  if (type === 'apiKey') {
    return req.headers['x-api-key'] === VALID_API_KEY;
  }
  return true;
}

function log(method, path, status) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}]  ${method.padEnd(6)} ${path.padEnd(35)} → ${status}`);
}

// ── Pagina de inicio (HTML amigable) ────────────────────────────────────────

function renderHomePage() {
  const productRows = Object.values(PRODUCTS).map(p => {
    const estado = (p.name && p.category && p.unit && p.expiry) ? 'Completo' : 'Campos vacios';
    return `
      <li>
        <b>${p.code}</b> — ${p.name || '(sin nombre)'} <small>(${estado})</small>
        <button onclick="testProduct('${p.code}')">Probar</button>
      </li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>INT5 — Mock API Server</title>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; max-width: 700px; margin: 30px auto;
         padding: 0 20px; line-height: 1.6; color: #222; }
  h1 { font-size: 22px; }
  h2 { font-size: 17px; margin-top: 28px; }
  ul { list-style: none; padding: 0; }
  li { padding: 8px 0; border-bottom: 1px solid #eee; }
  button { margin-left: 8px; padding: 4px 12px; cursor: pointer; }
  small { color: #888; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
  pre { background: #f6f8fa; padding: 14px; border-radius: 6px; overflow: auto;
        white-space: pre-wrap; word-break: break-all; }
  .ok { color: #1a7f37; }
</style>
</head>
<body>
  <h1>✅ INT5 — Mock API Server</h1>
  <p class="ok">Servidor activo en <code>http://localhost:${PORT}</code></p>
  <p>Simula un cliente externo para probar el wizard <b>API-RESP</b>.</p>

  <h2>Productos disponibles</h2>
  <ul>${productRows}</ul>

  <pre id="result" style="display:none;"></pre>

  <h2>Cómo configurar el wizard</h2>
  <ul>
    <li>Base URL: <code>http://localhost:${PORT}</code></li>
    <li>Endpoint Path: <code>/products/{productCode}</code></li>
    <li>Method: <code>GET</code> · Auth: <code>None</code></li>
  </ul>

  <h2>Credenciales (solo para endpoint con auth)</h2>
  <ul>
    <li>Bearer Token: <code>${VALID_BEARER}</code></li>
    <li>API Key: header <code>X-Api-Key</code> = <code>${VALID_API_KEY}</code></li>
  </ul>

  <script>
    async function testProduct(code) {
      const result = document.getElementById('result');
      result.style.display = 'block';
      result.textContent = 'GET /products/' + code + ' …';
      try {
        const res  = await fetch('/products/' + code);
        const json = await res.json();
        result.textContent = 'GET /products/' + code + '  →  ' + res.status + '\\n\\n' + JSON.stringify(json, null, 2);
      } catch (err) {
        result.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}

// ── Servidor ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const path   = url.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  // ── GET /products/:code ─────────────────────────────────────────────────
  const getMatch = path.match(/^\/products\/(.+)$/);
  if (method === 'GET' && getMatch) {
    const code    = decodeURIComponent(getMatch[1]);
    const product = lookupProduct(code);

    if (!product) {
      log(method, path, 404);
      send(res, 404, { error: 'Product not found', code });
      return;
    }

    log(method, path, 200);
    send(res, 200, product);
    return;
  }

  // ── POST /products/lookup ────────────────────────────────────────────────
  if (method === 'POST' && path === '/products/lookup') {
    let body;
    try { body = await parseBody(req); }
    catch { send(res, 400, { error: 'Invalid JSON body' }); return; }

    const code    = body.code || body.productCode || '';
    const product = lookupProduct(code);

    if (!product) {
      log(method, path, 404);
      send(res, 404, { error: 'Product not found', code });
      return;
    }

    log(method, path, 200);
    send(res, 200, product);
    return;
  }

  // ── POST /products/lookup-auth ──────────────────────────────────────────
  // Requiere Bearer token o API Key para probar autenticación
  if (method === 'POST' && path === '/products/lookup-auth') {
    const hasBearerAuth = checkAuth(req, 'bearer');
    const hasApiKeyAuth = checkAuth(req, 'apiKey');

    if (!hasBearerAuth && !hasApiKeyAuth) {
      log(method, path, 401);
      send(res, 401, {
        error: 'Unauthorized',
        hint:  `Use Bearer token "${VALID_BEARER}" or header X-Api-Key: ${VALID_API_KEY}`
      });
      return;
    }

    let body;
    try { body = await parseBody(req); }
    catch { send(res, 400, { error: 'Invalid JSON body' }); return; }

    const code    = body.code || body.productCode || '';
    const product = lookupProduct(code);

    if (!product) {
      log(method, path, 404);
      send(res, 404, { error: 'Product not found', code });
      return;
    }

    log(method, path, 200);
    send(res, 200, product);
    return;
  }

  // ── GET / — pagina de inicio amigable (HTML) ────────────────────────────
  if (method === 'GET' && path === '/') {
    sendHtml(res, 200, renderHomePage());
    return;
  }

  // ── GET /info — misma informacion en JSON (por si se necesita) ───────────
  if (method === 'GET' && path === '/info') {
    send(res, 200, {
      name:    'INT5 Mock API Server',
      port:    PORT,
      products: Object.keys(PRODUCTS),
      endpoints: [
        { method: 'GET',  path: '/products/{code}',      auth: 'none'            },
        { method: 'POST', path: '/products/lookup',      auth: 'none',   body: '{ "code": "ASP001" }' },
        { method: 'POST', path: '/products/lookup-auth', auth: 'bearer or apiKey', body: '{ "code": "ASP001" }' }
      ],
      auth: {
        bearer:  `Bearer ${VALID_BEARER}`,
        apiKey:  { header: 'X-Api-Key', value: VALID_API_KEY }
      }
    });
    return;
  }

  log(method, path, 404);
  send(res, 404, { error: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('  INT5 — Mock API Server');
  console.log('='.repeat(50));
  console.log(`\n  URL:     http://localhost:${PORT}`);
  console.log(`  Info:    GET  http://localhost:${PORT}/`);
  console.log('\n  Endpoints:');
  console.log(`    GET  /products/{code}`);
  console.log(`    POST /products/lookup          body: { "code": "..." }`);
  console.log(`    POST /products/lookup-auth     + auth requerida`);
  console.log('\n  Productos disponibles:');
  console.log('    ASP001   — Aspirina 100mg (completo)');
  console.log('    IBU200   — Ibuprofeno 200mg (completo)');
  console.log('    AMO500   — Amoxicilina 500mg (completo)');
  console.log('    INCOMPLETE — campos vacíos (para probar validación)');
  console.log('\n  Auth de prueba:');
  console.log(`    Bearer token:  ${VALID_BEARER}`);
  console.log(`    API Key header: X-Api-Key: ${VALID_API_KEY}`);
  console.log('\n' + '='.repeat(50) + '\n');
});
