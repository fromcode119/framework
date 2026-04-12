import http from 'http';
import httpProxy from 'http-proxy';
import { RequestSurfaceUtils } from '../packages/core/src/request-surface-utils';

class SingleDomainGateway {
  private static readonly DEFAULT_PORT = 3000;

  private static readonly DEFAULT_API_TARGET = 'http://api:3000';

  private static readonly DEFAULT_ADMIN_TARGET = 'http://admin:3000';

  private readonly proxy = httpProxy.createProxyServer({ ws: true });

  private readonly port = SingleDomainGateway.readPort();

  private readonly apiTarget = process.env.API_TARGET_URL || SingleDomainGateway.DEFAULT_API_TARGET;

  private readonly adminTarget = process.env.ADMIN_TARGET_URL || SingleDomainGateway.DEFAULT_ADMIN_TARGET;

  private readonly frontendTarget = String(process.env.FRONTEND_TARGET_URL || '').trim();

  start(): void {
    this.registerProxyErrorHandler();

    const server = http.createServer((req, res) => {
      this.proxy.web(req, res, { target: this.resolveTarget(req.url || '/') });
    });

    server.on('upgrade', (req, socket, head) => {
      this.proxy.ws(req, socket, head, { target: this.resolveTarget(req.url || '/') });
    });

    server.listen(this.port, () => {
      this.logStartup();
    });
  }

  private registerProxyErrorHandler(): void {
    this.proxy.on('error', (error, _req, res) => {
      console.error('[single-domain-gateway] Proxy error:', error.message);
      if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Service unavailable - is the target process running?');
      }
    });
  }

  private resolveTarget(pathname: string): string {
    if (RequestSurfaceUtils.isApiPath(pathname)) {
      return this.apiTarget;
    }

    if (RequestSurfaceUtils.isAdminPath(pathname)) {
      return this.adminTarget;
    }

    if (this.frontendTarget) {
      return this.frontendTarget;
    }

    if (pathname === '/' || pathname.startsWith('/?')) {
      return this.apiTarget;
    }

    return this.adminTarget;
  }

  private logStartup(): void {
    const mode = this.frontendTarget ? 'full' : 'api-admin';
    console.log(`[single-domain-gateway] Listening on http://0.0.0.0:${this.port} mode=${mode}`);
    console.log(`[single-domain-gateway] API target: ${this.apiTarget}`);
    console.log(`[single-domain-gateway] Admin target: ${this.adminTarget}`);
    if (this.frontendTarget) {
      console.log(`[single-domain-gateway] Frontend target: ${this.frontendTarget}`);
    }
    console.log(`[single-domain-gateway] API public URL: ${String(process.env.API_URL || '').trim() || '(not set)'}`);
    console.log(`[single-domain-gateway] Admin public URL: ${String(process.env.ADMIN_URL || '').trim() || '(not set)'}`);
    console.log(`[single-domain-gateway] Frontend public URL: ${String(process.env.FRONTEND_URL || '').trim() || '(not set)'}`);
  }

  private static readPort(): number {
    const parsed = Number.parseInt(String(process.env.PORT || SingleDomainGateway.DEFAULT_PORT), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : SingleDomainGateway.DEFAULT_PORT;
  }
}

new SingleDomainGateway().start();