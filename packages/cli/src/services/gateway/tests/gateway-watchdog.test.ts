import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
import net from 'net';
import { GatewayWatchdog } from '@cli/services/gateway/gateway-watchdog';

/** The watchdog asks the gateway it runs in; these stand in for a gateway that answers and one that does not. */
describe('GatewayWatchdog', () => {
  const closes: Array<() => Promise<void>> = [];
  afterEach(async () => { await Promise.all(closes.splice(0).map((close) => close())); });

  const listen = async (server: net.Server): Promise<number> => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    closes.push(() => new Promise((resolve) => { (server as http.Server).closeAllConnections?.(); server.close(() => resolve()); }));
    return (server.address() as net.AddressInfo).port;
  };

  it('ends a gateway that accepts connections but answers none, after the limit in a row', async () => {
    const sockets = new Set<net.Socket>();
    const hung = net.createServer((socket) => { sockets.add(socket); socket.on('error', () => undefined); });
    closes.push(async () => sockets.forEach((socket) => socket.destroy()));
    const port = await listen(hung);
    const reasons: string[] = [];
    const watchdog = new GatewayWatchdog(port, '/healthz', (reason) => reasons.push(reason), 60_000, 100, 3);
    watchdog.start();

    await watchdog.check();
    await watchdog.check();
    expect(reasons).toEqual([]);
    await watchdog.check();

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/^no answer from its own health check in \d+ ms, 3 checks in a row$/);
  });

  it('never ends a gateway that answers, and a single slow answer does not count against it once it recovers', async () => {
    let slow = true;
    const server = http.createServer((_req, res) => {
      if (slow) { slow = false; setTimeout(() => res.end('late'), 300); return; }
      res.end('ok');
    });
    const port = await listen(server);
    const reasons: string[] = [];
    const watchdog = new GatewayWatchdog(port, '/healthz', (reason) => reasons.push(reason), 60_000, 100, 2);
    watchdog.start();

    await watchdog.check();
    await watchdog.check();
    await watchdog.check();
    watchdog.stop();

    expect(reasons).toEqual([]);
  });

  it('ends a gateway that still answers but is in swap or at its memory limit — the state that hung it on 2026-11-01', async () => {
    const port = await listen(http.createServer((_req, res) => res.end('ok')));
    const MiB = 1024 * 1024;
    const cgroup = (anonMiB: number, swapMiB: number) => (file: string): string | null => ({
      'memory.max': String(512 * MiB),
      'memory.stat': `file 1234\nanon ${anonMiB * MiB}\nkernel 99`,
      'memory.swap.current': String(swapMiB * MiB),
    } as Record<string, string>)[file] ?? null;

    expect(new GatewayWatchdog(port, '/healthz', () => undefined, 60_000, 100, 1, cgroup(200, 0)).memoryPressure()).toBeNull();
    expect(new GatewayWatchdog(port, '/healthz', () => undefined, 60_000, 100, 1, cgroup(200, 14)).memoryPressure()).toBe('14 MiB in swap');
    expect(new GatewayWatchdog(port, '/healthz', () => undefined, 60_000, 100, 1, cgroup(450, 0)).memoryPressure()).toBe('memory at 450 MiB of its 512 MiB limit');
    // No limit set (`max`) or no cgroup v2: nothing to judge by, so never a reason to end the gateway.
    expect(new GatewayWatchdog(port, '/healthz', () => undefined, 60_000, 100, 1, (file) => (file === 'memory.max' ? 'max' : null)).memoryPressure()).toBeNull();

    // Answering promptly, memory does not count — whatever is in swap.
    const prompt: string[] = [];
    const fine = new GatewayWatchdog(port, '/healthz', (reason) => prompt.push(reason), 60_000, 3_000, 2, cgroup(200, 14));
    fine.start();
    await fine.check();
    await fine.check();
    fine.stop();
    expect(prompt).toEqual([]);
  });

  it('ends a gateway in swap once its answers are slow as well', async () => {
    const port = await listen(http.createServer((_req, res) => { setTimeout(() => res.end('ok'), GatewayWatchdog.SLOW_MS + 100); }));
    const cgroup = (file: string): string | null => ({ 'memory.max': String(512 * 1024 * 1024), 'memory.stat': 'anon 1', 'memory.swap.current': String(14 * 1024 * 1024) } as Record<string, string>)[file] ?? null;
    const reasons: string[] = [];
    const watchdog = new GatewayWatchdog(port, '/healthz', (reason) => reasons.push(reason), 60_000, 3_000, 2, cgroup);
    watchdog.start();
    await watchdog.check();
    await watchdog.check();

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/^14 MiB in swap, and its health check took \d+ ms, 2 checks in a row$/);
  }, 10_000);
});
