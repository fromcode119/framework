import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
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
});
