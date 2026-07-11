import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DA_AUTH_HELPER_BIN = path.join(__dirname, 'node_modules', '.bin', 'da-auth-helper');
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const PORT = Number(process.env.PORT || 4000);
const TARGET_ORIGIN = process.env.TARGET_ORIGIN;
const DA_ORG = process.env.DA_ORG || '';
const DA_REPO = process.env.DA_REPO || '';
const DA_REF = process.env.DA_REF || 'main';

if (!TARGET_ORIGIN) {
  // eslint-disable-next-line no-console
  console.error('Missing TARGET_ORIGIN. Copy .env.example to .env, set TARGET_ORIGIN, then run with --env-file=.env.');
  process.exit(1);
}

const OVERLAY_TAGS = [
  '<link rel="stylesheet" href="/__editor/overlay.css">',
  '<script type="module" src="/__editor/overlay.js"></script>',
].join('\n');

// Static editor assets served directly from this tool, never proxied.
const STATIC_FILES = {
  '/__editor/overlay.js': { file: 'overlay.js', type: 'text/javascript; charset=utf-8' },
  '/__editor/overlay.css': { file: 'overlay.css', type: 'text/css; charset=utf-8' },
  '/__editor/lib/block-patch.js': { file: 'lib/block-patch.js', type: 'text/javascript; charset=utf-8' },
  '/__editor/lib/da-source.js': { file: 'lib/da-source.js', type: 'text/javascript; charset=utf-8' },
  '/__editor/lib/admin-api.js': { file: 'lib/admin-api.js', type: 'text/javascript; charset=utf-8' },
  '/__editor/lib/block-templates.js': { file: 'lib/block-templates.js', type: 'text/javascript; charset=utf-8' },
};

// Headers that must never be blindly forwarded because they describe the
// transport of *this* hop, not the resource itself, or (for content-length)
// become wrong once the HTML body is rewritten.
const HOP_BY_HOP_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set(['content-length', 'content-encoding', 'transfer-encoding', 'connection']);

async function serveStatic(pathname, res) {
  const entry = STATIC_FILES[pathname];
  if (!entry) return false;
  try {
    const body = await readFile(path.join(PUBLIC_DIR, entry.file));
    res.writeHead(200, { 'content-type': entry.type, 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
  return true;
}

// Single in-flight `da-auth-helper` login at a time - concurrent requests
// (e.g. two panels, or a double click) await the same process rather than
// racing to bind port 9898 twice. Only the request handler ever sees the
// resolved token; it is never stored here or logged.
let inFlightLogin = null;

class LoginTimeoutError extends Error {}
class LoginCancelledError extends Error {}

function startLogin() {
  const state = { child: null, cancelledByClient: false };
  const promise = new Promise((resolve, reject) => {
    state.child = execFile(
      DA_AUTH_HELPER_BIN,
      ['token'],
      { cwd: __dirname, timeout: LOGIN_TIMEOUT_MS, killSignal: 'SIGTERM' },
      (err, stdout, stderr) => {
        inFlightLogin = null;
        if (err) {
          if (state.cancelledByClient) {
            reject(new LoginCancelledError('Login cancelled.'));
          } else if (err.killed) {
            reject(new LoginTimeoutError('Login timed out - try again or paste a token manually.'));
          } else {
            reject(new Error(stderr.trim() || err.message));
          }
          return;
        }
        const token = stdout.trim();
        if (!token) {
          reject(new Error('da-auth-helper exited without producing a token.'));
          return;
        }
        resolve(token);
      },
    );
  });
  inFlightLogin = { promise, state, subscribers: 0 };
  return inFlightLogin;
}

async function handleLogin(req, res) {
  const login = inFlightLogin || startLogin();
  login.subscribers += 1;

  let settled = false;
  const onClientClose = () => {
    if (settled) return;
    login.subscribers -= 1;
    if (login.subscribers <= 0 && login.state.child) {
      login.state.cancelledByClient = true;
      login.state.child.kill('SIGTERM');
    }
  };
  req.on('close', onClientClose);

  try {
    const token = await login.promise;
    settled = true;
    req.off('close', onClientClose);
    if (res.writableEnded) return;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ token }));
  } catch (err) {
    settled = true;
    req.off('close', onClientClose);
    if (res.writableEnded) return;
    const status = err instanceof LoginTimeoutError ? 504 : 500;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function serveConfig(res) {
  const body = JSON.stringify({ daOrg: DA_ORG, daRepo: DA_REPO, daRef: DA_REF });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function buildProxyRequestHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('host', new URL(TARGET_ORIGIN).host);
  // Ask the origin for uncompressed HTML so injection can operate on plain text.
  // (fetch/undici transparently decodes gzip/br anyway; requesting identity
  // just avoids relying on that for the html branch below.)
  headers.set('accept-encoding', 'identity');
  return headers;
}

function buildProxyResponseHeaders(upstream) {
  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    headers[key] = value;
  });
  return headers;
}

function injectOverlay(html) {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${OVERLAY_TAGS}\n</body>`);
  }
  return `${html}\n${OVERLAY_TAGS}\n`;
}

async function proxyRequest(req, res) {
  const targetUrl = new URL(req.url, TARGET_ORIGIN);
  const init = {
    method: req.method,
    headers: buildProxyRequestHeaders(req),
    redirect: 'follow',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Bad gateway: failed to reach ${TARGET_ORIGIN}\n${err.message}`);
    return;
  }

  const contentType = upstream.headers.get('content-type') || '';
  const responseHeaders = buildProxyResponseHeaders(upstream);

  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    const injected = injectOverlay(html);
    res.writeHead(upstream.status, {
      ...responseHeaders,
      'content-type': contentType,
      'content-length': Buffer.byteLength(injected),
    });
    res.end(injected);
    return;
  }

  res.writeHead(upstream.status, responseHeaders);
  if (upstream.body) {
    Readable.fromWeb(upstream.body).pipe(res);
  } else {
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/__editor/config') {
      serveConfig(res);
      return;
    }
    if (pathname === '/__editor/auth/login' && req.method === 'POST') {
      await handleLogin(req, res);
      return;
    }
    if (pathname.startsWith('/__editor/')) {
      const served = await serveStatic(pathname, res);
      if (served) return;
    }

    await proxyRequest(req, res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Request failed:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end(`Internal error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Custom editor proxy listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Proxying ${TARGET_ORIGIN}`);
});
