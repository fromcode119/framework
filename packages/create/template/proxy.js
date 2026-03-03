#!/usr/bin/env node
/**
 * Single-port reverse proxy for local development.
 * Routes all traffic through one port so you only open one browser tab.
 *
 *   /api/*    → API server (API_PORT, default 4000)
 *   /admin*   → Admin panel (ADMIN_PORT, default 3001)
 *   /*        → Frontend (FRONTEND_PORT, default 3002)
 *              if FRONTEND_PORT is not set, only /admin* is served
 */

const http = require('http');
const httpProxy = require('http-proxy');

const PROXY_PORT    = parseInt(process.env.PROXY_PORT    || '3000', 10);
const API_PORT      = parseInt(process.env.API_PORT      || '4000', 10);
const ADMIN_PORT    = parseInt(process.env.ADMIN_PORT    || '3001', 10);
const FRONTEND_PORT = process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : null;

const proxy = httpProxy.createProxyServer({ ws: true });

proxy.on('error', (err, _req, res) => {
  console.error('[proxy error]', err.message);
  if (res && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Service unavailable - is the target process running?');
  }
});

function target(port) {
  return `http://localhost:${port}`;
}

function route(url) {
  if (url.startsWith('/api'))     return target(API_PORT);
  if (url.startsWith('/plugins')) return target(API_PORT);
  if (url.startsWith('/themes'))  return target(API_PORT);
  if (url.startsWith('/uploads')) return target(API_PORT);
  if (url.startsWith('/admin'))   return target(ADMIN_PORT);
  return FRONTEND_PORT ? target(FRONTEND_PORT) : null;
}

const server = http.createServer((req, res) => {
  const targetUrl = route(req.url || '/');
  if (!targetUrl) {
    const body = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Frontend Not Running</title></head>
  <body style="font-family: system-ui; margin: 40px;">
    <h2>Frontend is not running</h2>
    <p>Open <a href="/admin">/admin</a> for Admin, or run <code>npm run dev:full</code> to serve frontend on <code>/</code>.</p>
  </body>
</html>`;
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
    return;
  }
  proxy.web(req, res, { target: targetUrl });
});

server.on('upgrade', (req, socket, head) => {
  const targetUrl = route(req.url || '/');
  if (!targetUrl) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, { target: targetUrl });
});

server.listen(PROXY_PORT, () => {
  const mode = FRONTEND_PORT ? 'full (api + admin + frontend)' : 'api-admin';
  console.log(`[proxy] http://localhost:${PROXY_PORT}  mode=${mode}`);
  console.log(`[proxy]   /api/*   → :${API_PORT}`);
  console.log(`[proxy]   /plugins* → :${API_PORT}`);
  console.log(`[proxy]   /themes*  → :${API_PORT}`);
  console.log(`[proxy]   /uploads* → :${API_PORT}`);
  console.log(`[proxy]   /admin*  → :${ADMIN_PORT}`);
  if (FRONTEND_PORT) {
    console.log(`[proxy]   /*       → :${FRONTEND_PORT}`);
  } else {
    console.log(`[proxy]   /*       → 404 + hint  (no frontend; use /admin or dev:full)`);
  }
});
