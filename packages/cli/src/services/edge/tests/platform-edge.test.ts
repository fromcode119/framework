import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import net from 'net';
import { EdgeUpstreams } from '@cli/services/edge/edge-upstreams';
import { PlatformEdge } from '@cli/services/edge/platform-edge';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';

/** A gateway: answers with its name and the visitor it was told about. */
class GatewayFixture {
  static async start(name: string, host: string, port: number): Promise<GatewayListener> {
    const listener = new GatewayListener(http.createServer((req, res) => res.end(`${name} ${req.socket.remoteAddress}`)));
    await new Promise<void>((resolve) => listener.listen(port, resolve, host));
    return listener;
  }
}

/** A gateway out of memory: the port accepts, nothing is ever answered. */
class HungGatewayFixture {
  static async start(host: string, port: number): Promise<net.Server> {
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => { sockets.add(socket); socket.on('error', () => undefined); });
    server.on('close', () => sockets.forEach((socket) => socket.destroy()));
    await new Promise<void>((resolve) => server.listen(port, host, resolve));
    const close = server.close.bind(server);
    server.close = ((callback?: (error?: Error) => void) => { sockets.forEach((socket) => socket.destroy()); return close(callback); }) as typeof server.close;
    return server;
  }
}

/**
 * The reason `edge` exists: a gateway replaced in the middle of traffic, and no request failing. Two
 * gateways on the same port (127.0.0.1 and ::1, as two containers would be on the network); requests
 * stream through the edge; one gateway stops mid-stream.
 */
describe('PlatformEdge', () => {
  const stops: Array<() => Promise<void>> = [];
  afterEach(async () => { vi.restoreAllMocks(); await Promise.all(stops.splice(0).map((stop) => stop())); });

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

  it('still sends visitors to its only gateway while that gateway fails its health check', async () => {
    // A lossy link: the check port answered once, then stops; the visitor's connection still gets through.
    const gateway = await GatewayFixture.start('only', '127.0.0.1', 0);
    const check = await GatewayFixture.start('check', '127.0.0.1', 0);
    const upstreams = new EdgeUpstreams('gateways', check.port, 60_000, async () => ['127.0.0.1']);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: gateway.port }]);
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => gateway.stop(0));
    await check.stop(0);
    await upstreams.check();

    expect(upstreams.healthyCount).toBe(0);
    const body = await new Promise<string>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: edgePort, path: '/', agent: false }, (res) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => resolve(text));
      }).on('error', reject);
    });
    expect(body.startsWith('only ')).toBe(true);
  }, 10_000);

  it('tries its only gateway again when a connection to it is lost, instead of refusing the visitor', async () => {
    const gateway = await GatewayFixture.start('only', '127.0.0.1', 0);
    const upstreams = new EdgeUpstreams('gateways', gateway.port, 60_000, async () => ['127.0.0.1']);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: gateway.port }]);
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => gateway.stop(0));
    // The first connection is lost on the way, as a dropped SYN would be; the next gets through.
    const open = (PlatformEdge as any).open.bind(PlatformEdge);
    const spy = vi.spyOn(PlatformEdge as any, 'open').mockImplementationOnce(async () => null).mockImplementation(open);

    const body = await new Promise<string>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: edgePort, path: '/', agent: false }, (res) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => resolve(text));
      }).on('error', reject);
    });
    expect(body.startsWith('only ')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('offers a failing gateway as a last resort only within a minute of its last accepted check, and only while the lookup returns it', async () => {
    const check = await GatewayFixture.start('check', '127.0.0.1', 0);
    let clock = 1_000_000;
    let resolved = ['127.0.0.1'];
    const upstreams = new EdgeUpstreams('gateways', check.port, 60_000, async () => resolved, () => clock);
    await upstreams.check();
    await check.stop(0);
    await upstreams.check();

    expect(upstreams.candidates(new Set())).toEqual(['127.0.0.1']);
    clock += EdgeUpstreams.LAST_RESORT_MS + 1;
    expect(upstreams.candidates(new Set())).toEqual([]);

    clock -= EdgeUpstreams.LAST_RESORT_MS;
    resolved = ['10.0.0.9'];
    await upstreams.check();
    expect(upstreams.candidates(new Set())).toEqual([]);
  }, 10_000);

  it('takes a gateway that accepts but never answers out of rotation while another answers', async () => {
    const hung = await HungGatewayFixture.start('127.0.0.1', 0);
    const port = (hung.address() as net.AddressInfo).port;
    const good = await GatewayFixture.start('good', '::1', port);
    const upstreams = new EdgeUpstreams('gateways', port, 200, async () => ['127.0.0.1', '::1']);
    stops.push(async () => { upstreams.stop(); await new Promise((resolve) => hung.close(resolve)); }, () => good.stop(0));

    await upstreams.check();

    expect(upstreams.candidates(new Set())).toEqual(['::1']);
  }, 10_000);

  it('keeps a gateway that only accepts when no gateway answers, rather than refusing every visitor', async () => {
    const hung = await HungGatewayFixture.start('127.0.0.1', 0);
    const port = (hung.address() as net.AddressInfo).port;
    const upstreams = new EdgeUpstreams('gateways', port, 200, async () => ['127.0.0.1', '::1']);
    stops.push(async () => { upstreams.stop(); await new Promise((resolve) => hung.close(resolve)); });

    await upstreams.check();

    expect(upstreams.candidates(new Set())).toEqual(['127.0.0.1']);
  }, 10_000);
});
