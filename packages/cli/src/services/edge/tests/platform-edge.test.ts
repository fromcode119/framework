import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
import net from 'net';
import { EdgeUpstreams } from '@cli/services/edge/edge-upstreams';
import { PlatformEdge } from '@cli/services/edge/platform-edge';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';

/** A gateway: answers with its name and the visitor it was told about. */
class GatewayFixture {
  static async start(name: string, host: string, port: number): Promise<GatewayListener> {
    const listener = new GatewayListener(http.createServer((req, res) => res.end(`${name} ${req.socket.remoteAddress}`)));
    await new Promise<void>((resolve) => listener.listen(port, resolve, host));
    return listener;
  }
}

/**
 * The reason `edge` exists: a gateway replaced in the middle of traffic, and no request failing. Two
 * gateways on the same port (127.0.0.1 and ::1, as two containers would be on the network); requests
 * stream through the edge; one gateway stops mid-stream.
 */
describe('PlatformEdge', () => {
  const stops: Array<() => Promise<void>> = [];
  afterEach(async () => { await Promise.all(stops.splice(0).map((stop) => stop())); });

  it('keeps every request answered while a gateway behind it is replaced, and tells the gateway the visitor', async () => {
    const a = await GatewayFixture.start('a', '127.0.0.1', 0);
    const port = a.port;
    const b = await GatewayFixture.start('b', '::1', port);
    const upstreams = new EdgeUpstreams('gateways', port, 200, async () => ['127.0.0.1', '::1']);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: port }]);
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => b.stop(0));

    const agent = new http.Agent({ keepAlive: false });
    const get = () => new Promise<{ status: number; body: string }>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: edgePort, path: '/', agent }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }).on('error', reject);
    });

    const results: Array<{ status: number; body: string } | string> = [];
    let stopping: Promise<void> | null = null;
    for (let i = 0; i < 120; i += 1) {
      if (i === 40) stopping = a.stop(2_000);
      results.push(await get().catch((error) => String(error)));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await stopping;

    const failed = results.filter((result) => typeof result === 'string' || result.status !== 200);
    expect(failed).toEqual([]);
    const bodies = (results as Array<{ body: string }>).map((result) => result.body);
    // Both served before the swap; only `b` after it — and each was told the visitor, not the edge.
    expect(bodies.slice(0, 40).some((body) => body.startsWith('a '))).toBe(true);
    expect(bodies.slice(60).every((body) => body.startsWith('b '))).toBe(true);
    expect(bodies.every((body) => /127\.0\.0\.1$/.test(body))).toBe(true);
  }, 30_000);

  it('refuses the visitor only when no gateway answers at all', async () => {
    const upstreams = new EdgeUpstreams('gateways', 1, 200, async () => []);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: 1 }]);
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0));
    await expect(new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port: edgePort, path: '/' }, resolve).on('error', reject))).rejects.toThrow();
  });

  /** A raw HTTP request through `port`, optionally preceded by a PROXY header naming `visitor`; the response body. */
  const ask = (port: number, visitor?: string) => new Promise<string>((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      if (visitor) socket.write(GatewayProxyProtocol.header(visitor, 40_000, '127.0.0.1', port));
      socket.write('GET / HTTP/1.1\r\nHost: example.test\r\nConnection: close\r\n\r\n');
    });
    let raw = '';
    socket.on('data', (chunk) => { raw += chunk; });
    socket.on('end', () => resolve(raw.split('\r\n\r\n').slice(1).join('\r\n\r\n')));
    socket.on('error', reject);
  });

  it('passes on the visitor a trusted relay in front of it names', async () => {
    const gateway = await GatewayFixture.start('g', '127.0.0.1', 0);
    const edge = new PlatformEdge(new EdgeUpstreams('gateways', gateway.port, 200, async () => ['127.0.0.1']), [{ listen: 0, upstreamPort: gateway.port }], new Set(['127.0.0.1']));
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => gateway.stop(0));

    expect(await ask(edgePort, '203.0.113.7')).toBe('g 203.0.113.7');
    // The relay's own health check, or a request it sends without a header: still answered, as the relay.
    expect(await ask(edgePort)).toBe('g 127.0.0.1');
  });

  it('never believes a header from an address that is not a trusted relay', async () => {
    const gateway = await GatewayFixture.start('g', '127.0.0.1', 0);
    const edge = new PlatformEdge(new EdgeUpstreams('gateways', gateway.port, 200, async () => ['127.0.0.1']), [{ listen: 0, upstreamPort: gateway.port }], new Set(['198.51.100.1']));
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => gateway.stop(0));

    expect(await ask(edgePort, '203.0.113.7')).not.toContain('203.0.113.7');
    expect(await ask(edgePort)).toBe('g 127.0.0.1');
  });

  it('chains: a relay edge in front of the platform edge, the visitor reaching the gateway', async () => {
    const gateway = await GatewayFixture.start('g', '127.0.0.1', 0);
    const platform = new PlatformEdge(new EdgeUpstreams('gateways', gateway.port, 200, async () => ['127.0.0.1']), [{ listen: 0, upstreamPort: gateway.port }], new Set(['127.0.0.1']));
    const [platformPort] = await platform.start();
    const relay = new PlatformEdge(new EdgeUpstreams('platform', platformPort, 200, async () => ['127.0.0.1']), [{ listen: 0, upstreamPort: platformPort }]);
    const [relayPort] = await relay.start();
    stops.push(() => relay.stop(0), () => platform.stop(0), () => gateway.stop(0));

    // The relay sees the visitor as 127.0.0.1 and says so; the platform edge believes it and passes it on.
    expect(await ask(relayPort)).toBe('g 127.0.0.1');
  });
});
