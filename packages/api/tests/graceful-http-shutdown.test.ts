import http from 'http';
import type { AddressInfo } from 'net';
import { describe, expect, it } from 'vitest';
import { GracefulHttpShutdown } from '@api/server/graceful-http-shutdown';

/**
 * A rolling deploy stops the old api while it is still serving. The request in flight must finish, a new
 * connection must be refused, and the process must exit only after that — not die mid-response.
 */
class ShutdownFixture {
  static async server(): Promise<{ server: http.Server; port: number; exits: number[]; shutdown: GracefulHttpShutdown }> {
    const server = http.createServer((req, res) => {
      const delay = req.url === '/slow' ? 300 : 0;
      setTimeout(() => res.end(`done ${req.url}`), delay);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const exits: number[] = [];
    const shutdown = new GracefulHttpShutdown(server, { info() {}, warn() {} }, (code) => exits.push(code));
    return { server, port: (server.address() as AddressInfo).port, exits, shutdown };
  }

  static get(port: number, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path, agent: false }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });
  }
}

describe('GracefulHttpShutdown', () => {
  it('finishes the request in flight, refuses new ones, then exits', async () => {
    const { port, exits, shutdown } = await ShutdownFixture.server();
    const inFlight = ShutdownFixture.get(port, '/slow');
    await new Promise((resolve) => setTimeout(resolve, 50));

    shutdown.stop('SIGTERM');
    expect(exits).toEqual([]);
    await expect(ShutdownFixture.get(port, '/new')).rejects.toThrow();

    expect(await inFlight).toBe('done /slow');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(exits).toEqual([0]);
  });

  it('exits once for repeated signals', async () => {
    const { exits, shutdown } = await ShutdownFixture.server();
    shutdown.stop('SIGTERM');
    shutdown.stop('SIGINT');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(exits).toEqual([0]);
  });
});
