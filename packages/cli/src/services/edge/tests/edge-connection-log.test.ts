import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import { Logger } from '@fromcode119/core';
import { EdgeUpstreams } from '@cli/services/edge/edge-upstreams';
import { PlatformEdge } from '@cli/services/edge/platform-edge';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';

/** Lines the edge wrote, by level. */
class EdgeLines {
  readonly lines: Array<{ level: string; line: string }> = [];
  constructor() {
    vi.spyOn(Logger.prototype, 'info').mockImplementation((line: string) => { this.lines.push({ level: 'info', line }); });
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((line: string) => { this.lines.push({ level: 'warn', line }); });
  }
  async waitFor(count: number): Promise<void> {
    for (let i = 0; i < 200 && this.lines.length < count; i++) await new Promise((r) => setTimeout(r, 10));
  }
}

const startGateway = async (port = 0): Promise<GatewayListener> => {
  const listener = new GatewayListener(http.createServer((_req, res) => res.end('ok')));
  await new Promise<void>((resolve) => listener.listen(port, resolve, '127.0.0.1'));
  return listener;
};

const get = (port: number) => new Promise<string>((resolve) => {
  http.get({ host: '127.0.0.1', port, path: '/', agent: false }, (res) => {
    let text = '';
    res.on('data', (chunk) => { text += chunk; });
    res.on('end', () => resolve(text));
  }).on('error', (error) => resolve(`error: ${error.message}`));
});

describe('EdgeConnectionLog — what only the edge can log', () => {
  const stops: Array<() => Promise<void>> = [];
  afterEach(async () => { vi.restoreAllMocks(); await Promise.all(stops.splice(0).map((stop) => stop())); });

  it('writes nothing for a connection a gateway took — that gateway logs it', async () => {
    const gateway = await startGateway();
    const upstreams = new EdgeUpstreams('gateways', gateway.port, 60_000, async () => ['127.0.0.1']);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: gateway.port }]);
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => gateway.stop(0));
    const lines = new EdgeLines();

    expect(await get(edgePort)).toBe('ok');
    await new Promise((r) => setTimeout(r, 50));
    expect(lines.lines).toEqual([]);
  });

  it('logs a visitor no gateway accepted as dropped, at warn, with every gateway it tried', async () => {
    // A gateway known to the edge whose port refuses every connection.
    const gateway = await startGateway();
    const deadPort = gateway.port;
    const upstreams = new EdgeUpstreams('gateways', deadPort, 60_000, async () => ['127.0.0.1']);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: deadPort }]);
    const [edgePort] = await edge.start();
    await gateway.stop(0);
    stops.push(() => edge.stop(0));
    const lines = new EdgeLines();

    expect(await get(edgePort)).toMatch(/^error:/);
    await lines.waitFor(1);
    expect(lines.lines).toEqual([{ level: 'warn', line: expect.stringMatching(new RegExp(`^:${edgePort} dropped \\d+ms — no gateway accepted it after 3 attempt\\(s\\), tried 127\\.0\\.0\\.1$`)) }]);
  });

  it('logs a visitor that got through only after a refusal as retried', async () => {
    const gateway = await startGateway();
    const upstreams = new EdgeUpstreams('gateways', gateway.port, 60_000, async () => ['127.0.0.1']);
    const edge = new PlatformEdge(upstreams, [{ listen: 0, upstreamPort: gateway.port }]);
    const [edgePort] = await edge.start();
    stops.push(() => edge.stop(0), () => gateway.stop(0));
    const open = (PlatformEdge as any).open.bind(PlatformEdge);
    vi.spyOn(PlatformEdge as any, 'open').mockImplementationOnce(async () => null).mockImplementation(open);
    const lines = new EdgeLines();

    expect(await get(edgePort)).toBe('ok');
    await lines.waitFor(1);
    expect(lines.lines).toEqual([{ level: 'info', line: expect.stringMatching(/ retried \d+ms — reached 127\.0\.0\.1 on attempt 2, refused by 127\.0\.0\.1$/) }]);
  });
});
