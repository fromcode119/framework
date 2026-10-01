import http from 'http';
import type { AddressInfo } from 'net';

/**
 * Lets an app start on a private port and take the public one later — with the same request handler,
 * not a proxy in between.
 *
 * `next start` builds its server with `http.createServer(requestListener)` and listens at once. While
 * it starts, `capture` notes every server created, so the one listening on the private port can be
 * found afterwards; `open` then serves that server's own `request` and `upgrade` listeners on a second
 * server bound to the public address. Until `open`, a connection to the public port is refused — which
 * the platform gateway answers by trying the app's other container.
 */
export class PublicServerHandover {
  /** Runs `start` while recording the http servers it creates. */
  static async capture(start: () => Promise<void>): Promise<http.Server[]> {
    const created: http.Server[] = [];
    const original = http.createServer;
    (http as { createServer: typeof http.createServer }).createServer = ((...args: Parameters<typeof http.createServer>) => {
      const server = (original as (...a: Parameters<typeof http.createServer>) => http.Server)(...args);
      created.push(server);
      return server;
    }) as typeof http.createServer;
    try {
      await start();
    } finally {
      (http as { createServer: typeof http.createServer }).createServer = original;
    }
    return created;
  }

  /** The captured server listening on `port`. */
  static listeningOn(servers: http.Server[], port: number): http.Server | null {
    return servers.find((server) => (server.address() as AddressInfo | null)?.port === port) ?? null;
  }

  /** Serves `from`'s handlers on `port`/`hostname` too; resolves once listening. */
  static open(from: http.Server, port: number, hostname: string): Promise<http.Server> {
    const server = http.createServer();
    for (const listener of from.listeners('request')) server.on('request', listener as (...args: unknown[]) => void);
    for (const listener of from.listeners('upgrade')) server.on('upgrade', listener as (...args: unknown[]) => void);
    server.keepAliveTimeout = from.keepAliveTimeout;
    server.headersTimeout = from.headersTimeout;
    server.requestTimeout = from.requestTimeout;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, hostname, () => {
        server.off('error', reject);
        resolve(server);
      });
    });
  }
}
