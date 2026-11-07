import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import http2 from 'http2';
import net from 'net';
import { Logger } from '@fromcode119/core';
import { GatewayAccessLog } from '@cli/services/gateway/gateway-access-log';
import { GatewayHttp2Adapter } from '@cli/services/gateway/gateway-http2-adapter';

/** A real server whose handler goes through the access log, and the lines it wrote. */
class LoggedServer {
  readonly lines: Array<{ level: 'info' | 'warn'; line: string }> = [];
  private server: http.Server | http2.Http2Server | null = null;
  private readonly spies = [
    vi.spyOn(Logger.prototype, 'info').mockImplementation((line: string) => { this.lines.push({ level: 'info', line }); }),
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((line: string) => { this.lines.push({ level: 'warn', line }); }),
  ];

  constructor(private readonly respond: (req: any, res: any) => void, private readonly upstream?: string) {}

  start(kind: 'http1' | 'http2'): Promise<number> {
    const log = new GatewayAccessLog(() => this.upstream, (url) => url === '/healthz');
    // As the TLS listener does: an HTTP/2 request's `:authority` becomes `host` before the gateway sees it.
    const handler = (req: any, res: any) => { GatewayHttp2Adapter.fromHttp2(req); log.track(req, res); this.respond(req, res); };
    this.server = kind === 'http1' ? http.createServer(handler) : http2.createServer(handler);
    return new Promise((resolve) => this.server!.listen(0, '127.0.0.1', () => resolve((this.server!.address() as net.AddressInfo).port)));
  }

  async waitForLines(count: number): Promise<void> {
    for (let i = 0; i < 100 && this.lines.length < count; i++) await new Promise((r) => setTimeout(r, 10));
  }

  async stop(): Promise<void> {
    this.spies.forEach((spy) => spy.mockRestore());
    await new Promise((resolve) => (this.server ? this.server.close(() => resolve(null)) : resolve(null)));
  }
}

const ok = (_req: any, res: any) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); };
const get = (port: number, path: string, host = 'shop.example') => new Promise<number>((resolve, reject) => {
  http.get({ port, host: '127.0.0.1', path, headers: { host } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode || 0)); }).on('error', reject);
});

describe('GatewayAccessLog — the gateway access log', () => {
  let server: LoggedServer | null = null;
  afterEach(async () => { await server?.stop(); server = null; });

  it('writes one line per request with host, path, status, duration and upstream service, never the query', async () => {
    server = new LoggedServer(ok, 'http://frontend:3000');
    const port = await server.start('http1');
    await get(port, '/products/tea?email=person@example.com&token=abc');
    await server.waitForLines(1);
    expect(server.lines).toHaveLength(1);
    expect(server.lines[0].level).toBe('info');
    expect(server.lines[0].line).toMatch(/^shop\.example GET \/products\/tea 200 \d+ms upstream=frontend$/);
  });

  it('names the gateway itself when it answered without forwarding, and warns on a 5xx', async () => {
    server = new LoggedServer((_req, res) => { res.writeHead(502); res.end(); });
    const port = await server.start('http1');
    await get(port, '/');
    await server.waitForLines(1);
    expect(server.lines[0]).toEqual({ level: 'warn', line: expect.stringMatching(/ GET \/ 502 \d+ms upstream=gateway$/) });
  });

  it('skips the paths it is told to skip', async () => {
    server = new LoggedServer(ok);
    const port = await server.start('http1');
    await get(port, '/healthz');
    await get(port, '/after');
    await server.waitForLines(1);
    expect(server.lines.map((l) => l.line)).toEqual([expect.stringContaining('GET /after 200')]);
  });

  it('logs a client that left before the response ended as aborted', async () => {
    server = new LoggedServer((_req, res) => { res.writeHead(200); res.write('partial'); });
    const port = await server.start('http1');
    await new Promise<void>((resolve) => {
      const req = http.get({ port, host: '127.0.0.1', path: '/slow' }, (res) => { res.once('data', () => { req.destroy(); resolve(); }); });
      req.on('error', () => resolve());
    });
    await server.waitForLines(1);
    expect(server.lines[0]).toEqual({ level: 'warn', line: expect.stringMatching(/ GET \/slow aborted \d+ms /) });
  });

  it('reports the real status for an HTTP/2 response, not aborted', async () => {
    server = new LoggedServer(ok, 'http://admin:3001');
    const port = await server.start('http2');
    const client = http2.connect(`http://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      const stream = client.request({ ':path': '/dashboard?x=1', ':authority': 'console.example' });
      stream.on('error', reject);
      stream.resume();
      stream.on('end', () => resolve());
    });
    client.close();
    await server.waitForLines(1);
    expect(server.lines[0]).toEqual({ level: 'info', line: expect.stringMatching(/^console\.example GET \/dashboard 200 \d+ms upstream=admin$/) });
  });

  describe('WebSocket upgrades', () => {
    /** A server whose upgrades go through the log; `decide` plays the gateway's part for each one. */
    const upgradeServer = (decide: (log: GatewayAccessLog, req: http.IncomingMessage, socket: net.Socket) => void) => {
      const lines: Array<{ level: string; line: string }> = [];
      const spies = [
        vi.spyOn(Logger.prototype, 'info').mockImplementation((line: string) => { lines.push({ level: 'info', line }); }),
        vi.spyOn(Logger.prototype, 'warn').mockImplementation((line: string) => { lines.push({ level: 'warn', line }); }),
      ];
      const log = new GatewayAccessLog(() => 'http://admin:3001', () => false);
      const httpServer = http.createServer();
      httpServer.on('upgrade', (req, socket: net.Socket) => { log.trackUpgrade(req, socket); decide(log, req, socket); });
      const port = new Promise<number>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve((httpServer.address() as net.AddressInfo).port)));
      const stop = async () => { spies.forEach((spy) => spy.mockRestore()); await new Promise((r) => httpServer.close(() => r(null))); };
      return { lines, port, stop };
    };
    const upgradeRequest = (port: number) => new Promise<void>((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => socket.write(
        'GET /_next/webpack-hmr?token=abc HTTP/1.1\r\nHost: console.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'));
      socket.on('data', () => socket.end());
      socket.on('close', () => resolve());
      socket.on('error', () => resolve());
    });
    const waitFor = async (lines: unknown[]) => { for (let i = 0; i < 100 && !lines.length; i++) await new Promise((r) => setTimeout(r, 10)); };

    it('logs an accepted upgrade once, on close, as ws 101 with its lifetime and upstream — never the query', async () => {
      const server = upgradeServer((log, req, socket) => {
        log.upgradeAnswered(req, 101);
        socket.on('end', () => socket.end()); // a peer closes its side when the client does
        socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      });
      await upgradeRequest(await server.port);
      await waitFor(server.lines);
      await server.stop();
      expect(server.lines).toEqual([{ level: 'info', line: expect.stringMatching(/^console\.example GET \/_next\/webpack-hmr ws 101 \d+ms upstream=admin$/) }]);
    });

    it('logs an upgrade the gateway closed itself as refused', async () => {
      const server = upgradeServer((log, req, socket) => { log.upgradeRefused(req); socket.destroy(); });
      await upgradeRequest(await server.port);
      await waitFor(server.lines);
      await server.stop();
      expect(server.lines).toEqual([{ level: 'info', line: expect.stringContaining(' ws refused ') }]);
    });

    it('logs an upstream that declined with a server error at warn, and one that never answered as failed', async () => {
      const declined = upgradeServer((log, req, socket) => { log.upgradeAnswered(req, 503); socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); });
      await upgradeRequest(await declined.port);
      await waitFor(declined.lines);
      await declined.stop();
      expect(declined.lines).toEqual([{ level: 'warn', line: expect.stringContaining(' ws 503 ') }]);

      const silent = upgradeServer((_log, _req, socket) => { socket.destroy(); });
      await upgradeRequest(await silent.port);
      await waitFor(silent.lines);
      await silent.stop();
      expect(silent.lines).toEqual([{ level: 'warn', line: expect.stringContaining(' ws failed ') }]);
    });
  });
});
