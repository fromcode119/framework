import http from 'http';
import type { PlatformEdge } from '@cli/services/edge/platform-edge';
import type { EdgeIdentityStore } from '@cli/services/edge/platform/edge-identity-store';

/**
 * `/health` (the process is up) and `/ready` (it can serve: every server reachable, rules current, and —
 * on a platform — a valid certificate), on the address the configuration's `status` names. Meant for this
 * machine or its private network only; it is never one of the public listeners.
 */
export class EdgeStatusServer {
  private server: http.Server | null = null;

  constructor(private readonly edge: PlatformEdge, private readonly identity: EdgeIdentityStore | null) {}

  start(address: string, port: number): Promise<void> {
    const server = http.createServer((req, res) => {
      const ready = this.edge.ready && (!this.identity || this.identity.valid);
      const body = req.url === '/health' ? { ok: true } : req.url === '/ready' ? {
        ready,
        connections: this.edge.openConnections,
        ...(this.identity ? { certificateNotAfter: new Date(this.identity.notAfter).toISOString() } : {}),
      } : null;
      res.writeHead(body ? (req.url === '/ready' && !ready ? 503 : 200) : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body ?? { error: 'not_found' }));
    });
    this.server = server;
    return new Promise((resolve) => server.listen(port, address, () => resolve()));
  }

  stop(): void {
    this.server?.close();
  }
}
