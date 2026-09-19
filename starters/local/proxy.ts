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
 *              if FRONTEND_PORT is not set:
 *                /      → API
 *                /admin → admin
 *                other  → admin
 *
 * Run through `tsx` rather than compiled: this is a dev-only script inside the workspace, so there is
 * no artifact to ship and no build step worth keeping current. It differs from the proxy the
 * scaffolder emits, which IS compiled, because that one leaves the workspace and lands in a project
 * with no TypeScript toolchain of its own.
 */
class LocalProxy {
  private static readonly PROXY_PORT = parseInt(process.env.PROXY_PORT || '3000', 10);
  private static readonly API_PORT = parseInt(process.env.API_PORT || '4000', 10);
  private static readonly ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '3001', 10);

  /** Absent means the frontend is not in this run, which changes where `/` goes. */
  private static readonly FRONTEND_PORT = process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : null;

  private static readonly proxy = httpProxy.createProxyServer({ ws: true });

  private static target(port: number): string {
    return `http://localhost:${port}`;
  }

  private static route(url: string): string {
    if (url.startsWith('/api')) return LocalProxy.target(LocalProxy.API_PORT);
    if (url.startsWith('/plugins')) return LocalProxy.target(LocalProxy.API_PORT);
    if (url.startsWith('/themes')) return LocalProxy.target(LocalProxy.API_PORT);
    if (url.startsWith('/uploads')) return LocalProxy.target(LocalProxy.API_PORT);
    if (url.startsWith('/admin')) return LocalProxy.target(LocalProxy.ADMIN_PORT);
    if (LocalProxy.FRONTEND_PORT) return LocalProxy.target(LocalProxy.FRONTEND_PORT);

    // api-admin mode: keep root on API for quick backend checks.
    if (url === '/' || url.startsWith('/?')) return LocalProxy.target(LocalProxy.API_PORT);

    // Preserve admin asset/navigation behavior when frontend is disabled.
    return LocalProxy.target(LocalProxy.ADMIN_PORT);
  }

  /** A dead upstream answers 502 with the reason, rather than hanging the browser on a reset socket. */
  private static reportUpstreamFailure(): void {
    LocalProxy.proxy.on('error', (err: Error, _req: unknown, res: any) => {
      console.error('[proxy error]', err.message);
      if (res && res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Service unavailable - is the target process running?');
      }
    });
  }

  private static announce(): void {
    const mode = LocalProxy.FRONTEND_PORT ? 'full (api + admin + frontend)' : 'api-admin';
    console.log(`[proxy] http://localhost:${LocalProxy.PROXY_PORT}  mode=${mode}`);
    console.log(`[proxy]   /api/*   → :${LocalProxy.API_PORT}`);
    console.log(`[proxy]   /plugins* → :${LocalProxy.API_PORT}`);
    console.log(`[proxy]   /themes*  → :${LocalProxy.API_PORT}`);
    console.log(`[proxy]   /uploads* → :${LocalProxy.API_PORT}`);
    console.log(`[proxy]   /admin*  → :${LocalProxy.ADMIN_PORT}`);
    if (LocalProxy.FRONTEND_PORT) {
      console.log(`[proxy]   /*       → :${LocalProxy.FRONTEND_PORT}`);
    } else {
      console.log(`[proxy]   /        → :${LocalProxy.API_PORT}     (no frontend)`);
      console.log(`[proxy]   /admin*  → :${LocalProxy.ADMIN_PORT}`);
      console.log(`[proxy]   other    → :${LocalProxy.ADMIN_PORT}`);
    }
  }

  static main(): void {
    LocalProxy.reportUpstreamFailure();

    const server = http.createServer((req, res) => {
      LocalProxy.proxy.web(req, res, { target: LocalProxy.route(req.url || '/') });
    });

    // WebSocket (Next.js HMR, hot reload)
    server.on('upgrade', (req, socket, head) => {
      LocalProxy.proxy.ws(req, socket, head, { target: LocalProxy.route(req.url || '/') });
    });

    server.listen(LocalProxy.PROXY_PORT, () => LocalProxy.announce());
  }

  /** Runs on class initialisation, so nothing sits at module level. */
  static {
    LocalProxy.main();
  }
}
