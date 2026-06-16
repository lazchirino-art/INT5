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
  const productCards = Object.values(PRODUCTS).map(p => {
    const complete = p.name && p.category && p.unit && p.expiry;
    const badge = complete
      ? '<span class="badge badge-ok">Completo</span>'
      : '<span class="badge badge-warn">Campos vacios</span>';
    return `
      <div class="card">
        <div class="card-head">
          <code class="code">${p.code}</code>
          ${badge}
        </div>
        <div class="card-name">${p.name || '<em>(sin nombre)</em>'}</div>
        <div class="card-meta">${p.laboratory || '—'} · ${p.category || '—'}</div>
        <button class="test-btn" onclick="testProduct('${p.code}')">Probar GET /products/${p.code}</button>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>INT5 — Mock API Server</title>
<style>
  :root {
    --bg: #f5f7fb; --card: #ffffff; --text: #1a1f2e; --muted: #6b7280;
    --primary: #2d69ff; --primary-dark: #2445bd; --border: #e5e9f2;
    --ok: #16a34a; --ok-bg: #dcfce7; --warn: #d97706; --warn-bg: #fef3c7;
    --code-bg: #1e293b; --code-text: #e2e8f0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: var(--text);
    background: var(--bg); line-height: 1.5; padding: 32px 20px;
  }
  .wrap { max-width: 920px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--ok);
         box-shadow: 0 0 0 4px var(--ok-bg); }
  h1 { font-size: 26px; margin: 0; }
  .sub { color: var(--muted); margin: 0 0 28px; font-size: 15px; }
  .sub code { background: var(--code-bg); color: var(--code-text); padding: 2px 8px;
              border-radius: 6px; font-size: 13px; }
  h2 { font-size: 17px; margin: 30px 0 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .code { background: var(--code-bg); color: var(--code-text); padding: 3px 9px;
          border-radius: 6px; font-size: 13px; font-weight: 600; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
  .badge-ok { background: var(--ok-bg); color: var(--ok); }
  .badge-warn { background: var(--warn-bg); color: var(--warn); }
  .card-name { font-weight: 600; font-size: 15px; }
  .card-meta { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
  .test-btn { width: 100%; border: 0; border-radius: 8px; padding: 9px;
              background: linear-gradient(180deg, var(--primary), var(--primary-dark));
              color: #fff; font-size: 13px; cursor: pointer; transition: opacity .15s; }
  .test-btn:hover { opacity: .9; }
  table { width: 100%; border-collapse: collapse; background: var(--card);
          border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  th, td { text-align: left; padding: 11px 14px; font-size: 14px; border-bottom: 1px solid var(--border); }
  th { background: #f8fafc; font-weight: 600; }
  tr:last-child td { border-bottom: 0; }
  td code, .auth-box code { background: var(--code-bg); color: var(--code-text);
       padding: 2px 7px; border-radius: 5px; font-size: 12px; }
  .method { font-weight: 700; font-size: 12px; }
  .method.get { color: var(--ok); }
  .method.post { color: var(--primary); }
  .auth-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
              padding: 16px; font-size: 14px; }
  .auth-box div { margin: 6px 0; }
  .result { margin-top: 16px; background: var(--code-bg); color: var(--code-text);
            border-radius: 12px; padding: 16px; font-family: Consolas, monospace;
            font-size: 13px; white-space: pre-wrap; word-break: break-all;
            max-height: 360px; overflow: auto; display: none; }
  .result.show { display: block; }
  .result-title { color: var(--muted); font-size: 12px; margin-bottom: 8px; font-family: "Segoe UI"; }
  .foot { color: var(--muted); font-size: 13px; margin-top: 32px; text-align: center; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <span class="dot"></span>
      <h1>INT5 — Mock API Server</h1>
    </div>
    <p class="sub">Servidor de pruebas activo en <code>http://localhost:${PORT}</code> · Simula un cliente externo para el wizard API-RESP</p>

    <h2>Productos disponibles</h2>
    <div class="grid">${productCards}</div>

    <div id="result" class="result">
      <div class="result-title" id="resultTitle"></div>
      <div id="resultBody"></div>
    </div>

    <h2>Endpoints</h2>
    <table>
      <thead><tr><th>Metodo</th><th>Ruta</th><th>Auth</th></tr></thead>
      <tbody>
        <tr><td><span class="method get">GET</span></td><td><code>/products/{productCode}</code></td><td>Ninguna</td></tr>
        <tr><td><span class="method post">POST</span></td><td><code>/products/lookup</code></td><td>Ninguna</td></tr>
        <tr><td><span class="method post">POST</span></td><td><code>/products/lookup-auth</code></td><td>Bearer o API Key</td></tr>
      </tbody>
    </table>

    <h2>Credenciales de prueba</h2>
    <div class="auth-box">
      <div><strong>Bearer Token:</strong> <code>${VALID_BEARER}</code></div>
      <div><strong>API Key:</strong> header <code>X-Api-Key</code> = <code>${VALID_API_KEY}</code></div>
    </div>

    <p class="foot">Configura el wizard API-RESP con Base URL <code style="background:#1e293b;color:#e2e8f0;padding:2px 7px;border-radius:5px;">http://localhost:${PORT}</code> y Path <code style="background:#1e293b;color:#e2e8f0;padding:2px 7px;border-radius:5px;">/products/{productCode}</code></p>
  </div>

  <script>
    async function testProduct(code) {
      const result = document.getElementById('result');
      const title  = document.getElementById('resultTitle');
      const body   = document.getElementById('resultBody');
      result.classList.add('show');
      title.textContent = 'GET /products/' + code + ' …';
      body.textContent = 'Cargando…';
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      try {
        const res  = await fetch('/products/' + code);
        const json = await res.json();
        title.textContent = 'GET /products/' + code + '  →  ' + res.status + ' ' + res.statusText;
        body.textContent  = JSON.stringify(json, null, 2);
      } catch (err) {
        title.textContent = 'Error';
        body.textContent  = err.message;
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
