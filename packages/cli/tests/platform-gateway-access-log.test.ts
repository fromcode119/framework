import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import net from 'net';
import { Logger } from '@fromcode119/core';
import { PlatformGateway } from '@cli/services/platform-gateway';

/** The real gateway in front of an upstream, with the access-log lines it wrote. */
class GatewayUnderTest {
  readonly lines: Array<{ level: string; line: string }> = [];
  private readonly spies = [
    vi.spyOn(Logger.prototype, 'info').mockImplementation((line: string) => { if (line.includes(' ws ') || line.includes('ms upstream=')) this.lines.push({ level: 'info', line }); }),
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((line: string) => { if (line.includes(' ws ') || line.includes('ms upstream=')) this.lines.push({ level: 'warn', line }); }),
  ];
  private upstream: http.Server | null = null;
  private gateway: PlatformGateway | null = null;
  port = 0;

  async start(upgrade: (req: http.IncomingMessage, socket: net.Socket) => void): Promise<void> {
    this.upstream = http.createServer((_req, res) => { res.writeHead(200); res.end('ok'); });
    this.upstream.on('upgrade', (req, socket: net.Socket) => upgrade(req, socket));
    await new Promise<void>((resolve) => this.upstream!.listen(0, '127.0.0.1', resolve));
    const upstreamPort = (this.upstream.address() as net.AddressInfo).port;
    process.env.PORT = '0';
    process.env.API_TARGET_URL = `http://127.0.0.1:${upstreamPort}`;
    process.env.FRONTEND_TARGET_URL = `http://127.0.0.1:${upstreamPort}`;
    this.gateway = new PlatformGateway({ refresh: async () => null, resolveMap: async () => null, map: () => null, enabled: false, ageMs: 0 } as any);
    this.gateway.start();
    await this.gateway.listener!.listening;
    this.port = this.gateway.listener!.port;
  }

  /** Opens an upgrade through the gateway, holds it briefly once answered, then hangs up. Returns the status line. */
  upgrade(path: string): Promise<string> {
    return new Promise((resolve) => {
      const socket = net.connect({ port: this.port, host: '127.0.0.1' }, () => socket.write(
        `GET ${path} HTTP/1.1\r\nHost: shop.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`));
      let first = '';
      socket.once('data', (chunk) => { first = chunk.toString().split('\r\n')[0]; setTimeout(() => socket.destroy(), 50); });
      socket.on('close', () => resolve(first));
      socket.on('error', () => {});
    });
  }

  async waitForLines(count: number): Promise<void> {
    for (let i = 0; i < 200 && this.lines.length < count; i++) await new Promise((r) => setTimeout(r, 10));
  }

  async stop(): Promise<void> {
    this.spies.forEach((spy) => spy.mockRestore());
    await this.gateway?.stop(0);
    await new Promise((resolve) => (this.upstream ? this.upstream.close(() => resolve(null)) : resolve(null)));
  }
}

describe('PlatformGateway access log — WebSocket upgrades through the real gateway', () => {
  let gateway: GatewayUnderTest | null = null;
  afterEach(async () => { await gateway?.stop(); gateway = null; });

  it('logs an upgrade the upstream accepted as ws 101, once, when it closes, with its upstream and no query', async () => {
    gateway = new GatewayUnderTest();
    await gateway.start((_req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.on('error', () => {});
      socket.on('end', () => socket.end()); // a peer closes its side when the gateway does
    });
    expect(await gateway.upgrade('/api/socket?room=secret-room-token')).toBe('HTTP/1.1 101 Switching Protocols');
    await gateway.waitForLines(1);
    expect(gateway.lines).toEqual([{ level: 'info', line: expect.stringMatching(/^shop\.example GET \/api\/socket ws 101 \d+ms upstream=127\.0\.0\.1$/) }]);
  });

  it('logs an upgrade the upstream declined with the code it answered', async () => {
    gateway = new GatewayUnderTest();
    await gateway.start((_req, socket) => { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
    expect(await gateway.upgrade('/api/socket')).toBe('HTTP/1.1 401 Unauthorized');
    await gateway.waitForLines(1);
    expect(gateway.lines).toEqual([{ level: 'info', line: expect.stringContaining('GET /api/socket ws 401 ') }]);
  });

  it('logs an upgrade the upstream hung up on as failed, at warn', async () => {
    gateway = new GatewayUnderTest();
    await gateway.start((_req, socket) => { socket.destroy(); });
    await gateway.upgrade('/api/socket');
    await gateway.waitForLines(1);
    expect(gateway.lines).toEqual([{ level: 'warn', line: expect.stringContaining('GET /api/socket ws failed ') }]);
  });
});
