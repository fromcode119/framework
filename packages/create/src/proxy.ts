#!/usr/bin/env node
import http = require('http');
import httpProxy = require('http-proxy');

/**
 * Single-port reverse proxy for local development.
 * Routes all traffic through one port so you only open one browser tab.
 *
 *   /api/*    → API server (API_PORT, default 4000)
 *   /admin*   → Admin panel (ADMIN_PORT, default 3001)
 *   /*        → Frontend (FRONTEND_PORT, default 3002)
 *              if FRONTEND_PORT is not set, only /admin* is served
 *
 * Compiled to `proxy.js` and copied into every generated project, which runs it with plain `node`
 * and has no TypeScript toolchain of its own. The build transpiles rather than bundles
 * `http-proxy`, because the generated project declares that dependency itself and must resolve its
 * own copy; only `ProcessEntry` is inlined, so the shipped file needs nothing from the framework.
 */
export class DevProxy {
  private static readonly PROXY_PORT = parseInt(process.env.PROXY_PORT || '3000', 10);
  private static readonly API_PORT = parseInt(process.env.API_PORT || '4000', 10);
  private static readonly ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '3001', 10);

  /** Absent means "no frontend in this run" — `/` then answers a hint instead of proxying nowhere. */
  private static readonly FRONTEND_PORT = process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : null;

  private static readonly proxy = httpProxy.createProxyServer({ ws: true });

  private static target(port: number): string {
    return `http://localhost:${port}`;
  }

  /** Which upstream serves this path, or `null` when only the frontend could and it is not running. */
  private static route(url: string): string | null {
    if (url.startsWith('/api')) return DevProxy.target(DevProxy.API_PORT);
    if (url.startsWith('/plugins')) return DevProxy.target(DevProxy.API_PORT);
    if (url.startsWith('/themes')) return DevProxy.target(DevProxy.API_PORT);
    if (url.startsWith('/uploads')) return DevProxy.target(DevProxy.API_PORT);
    if (url.startsWith('/admin')) return DevProxy.target(DevProxy.ADMIN_PORT);
    return DevProxy.FRONTEND_PORT ? DevProxy.target(DevProxy.FRONTEND_PORT) : null;
  }

  /** Says which command starts the missing piece, rather than failing to connect. */
  private static readonly NO_FRONTEND_PAGE = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Frontend Not Running</title></head>
  <body style="font-family: system-ui; margin: 40px;">
    <h2>Frontend is not running</h2>
    <p>Open <a href="/admin">/admin</a> for Admin, or run <code>npm run dev:full</code> to serve frontend on <code>/</code>.</p>
  </body>
</html>`;

  private static server(): http.Server {
    const server = http.createServer((req, res) => {
      const targetUrl = DevProxy.route(req.url || '/');
      if (!targetUrl) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(DevProxy.NO_FRONTEND_PAGE);
        return;
      }
      DevProxy.proxy.web(req, res, { target: targetUrl });
    });

    server.on('upgrade', (req, socket, head) => {
      const targetUrl = DevProxy.route(req.url || '/');
      if (!targetUrl) {
        socket.destroy();
        return;
      }
      DevProxy.proxy.ws(req, socket, head, { target: targetUrl });
    });

    return server;
  }

  private static announce(): void {
    const mode = DevProxy.FRONTEND_PORT ? 'full (api + admin + frontend)' : 'api-admin';
    console.log(`[proxy] http://localhost:${DevProxy.PROXY_PORT}  mode=${mode}`);
    console.log(`[proxy]   /api/*   → :${DevProxy.API_PORT}`);
    console.log(`[proxy]   /plugins* → :${DevProxy.API_PORT}`);
    console.log(`[proxy]   /themes*  → :${DevProxy.API_PORT}`);
    console.log(`[proxy]   /uploads* → :${DevProxy.API_PORT}`);
    console.log(`[proxy]   /admin*  → :${DevProxy.ADMIN_PORT}`);
    if (DevProxy.FRONTEND_PORT) {
      console.log(`[proxy]   /*       → :${DevProxy.FRONTEND_PORT}`);
    } else {
      console.log(`[proxy]   /*       → 404 + hint  (no frontend; use /admin or dev:full)`);
    }
  }

  /** Resolves to nothing: the listening server keeps the event loop alive, so the process stays up. */
  static main(): void {
    DevProxy.server().listen(DevProxy.PROXY_PORT, () => DevProxy.announce());
  }
  /**
   * Runs on class initialisation.
   *
   * A bare `DevProxy.main()` after the class would be a module-level call, which this codebase
   * does not allow in an entry file. `ProcessEntry` is the framework's decorator for exactly
   * this, but importing it here pulls the whole of core into a standalone binary — measured at
   * 1.66 MB against 3.7 KB — so the entry stays dependency-free and self-starts instead.
   */
  static {
    DevProxy.main();
  }
}
