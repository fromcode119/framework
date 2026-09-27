import { afterAll, afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { ExtensionHostLink } from '@core/process/extension-host/extension-host-link';
import { ExtensionHostLegacyLink } from '@core/process/extension-host/extension-host-legacy-link';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * Two REAL spawner sockets laid out the way `extension-host-main` lays them out — the running host and the
 * next one a deploy starts beside it. The api must start new processes in the newest, be told when that
 * changes (so plugins move), and lose nothing when the old host goes.
 */
describe('extension-hosts side by side', () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-hosts-'));
  const legacy = path.join(runtimeDir, ExtensionHostSocket.FILE);
  const hostsDir = path.join(runtimeDir, ExtensionHostSocket.HOSTS_DIR);
  fs.mkdirSync(hostsDir);
  const stops: Array<() => void> = [];

  /** One host: its own directory, its socket, and its announcement dated `birthSeconds`. */
  const host = async (name: string, birthSeconds: number) => {
    const dir = path.join(runtimeDir, name);
    fs.mkdirSync(dir);
    const socketPath = path.join(dir, ExtensionHostSocket.FILE);
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => { sockets.add(socket); void new PrivilegedSpawner(new SocketMessagePort(socket), dir, false); });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    const announcement = path.join(hostsDir, name);
    fs.writeFileSync(announcement, '');
    fs.utimesSync(announcement, birthSeconds, birthSeconds);
    const stop = () => { server.close(); for (const socket of sockets) socket.destroy(); fs.rmSync(announcement, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); };
    stops.push(stop);
    return { socketPath, stop };
  };

  afterEach(() => { for (const stop of stops.splice(0)) stop(); SpawnerClient.publish(null); SpawnerClient.publishUnavailable(null); });
  afterAll(() => fs.rmSync(runtimeDir, { recursive: true, force: true }));

  it('starts new processes in the newest host, says so when a newer one appears, and keeps going when the old one leaves', async () => {
    const lines: string[] = [];
    const changes: SpawnerClient[] = [];
    SpawnerClient.onChange(() => { changes.push(SpawnerClient.current()!); });
    const old = await host('h-old', 1_700_000_000);
    const first = await new ExtensionHostLink(legacy, (line) => lines.push(line), 100).start(2_000);
    expect(first).not.toBeNull();

    await host('h-new', 1_700_000_100);
    for (let i = 0; i < 50 && SpawnerClient.current() === first; i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    const second = SpawnerClient.current();
    expect(second).not.toBe(first);
    expect(changes).toEqual([second]);

    old.stop();
    await new Promise((resolve) => setTimeout(resolve, 200));
    // The old host going is not an outage: the new one is still published, and nothing says unavailable.
    expect(SpawnerClient.current()).toBe(second);
    expect(GuestProcessLaunchers.unavailableReason()).toBeNull();
    expect(lines.some((line) => line.includes('start again in the one that remains'))).toBe(true);
  }, 20_000);

  it('points the old top-level path at the newest host, but leaves a pre-hosts host listening there alone', async () => {
    const older = await host('h-aaa', 1_700_000_000);
    await host('h-bbb', 1_700_000_100);
    fs.mkdirSync(path.join(runtimeDir, 'plugin-left-behind'));

    // Only the newest acts.
    ExtensionHostLegacyLink.maintain(runtimeDir, 'h-aaa');
    expect(fs.existsSync(legacy)).toBe(false);
    ExtensionHostLegacyLink.maintain(runtimeDir, 'h-bbb');
    expect(fs.readlinkSync(legacy)).toBe(path.join('h-bbb', ExtensionHostSocket.FILE));
    // What a pre-hosts host left at the top level goes once the path is claimed; the hosts' own stay.
    expect(fs.existsSync(path.join(runtimeDir, 'plugin-left-behind'))).toBe(false);
    expect(fs.existsSync(path.join(runtimeDir, 'h-aaa'))).toBe(true);
    // An api that only knows the old path reaches the newest host through it.
    const viaLegacy = await SpawnerClient.connect(legacy, 1_000);
    expect(viaLegacy).not.toBeNull();

    ExtensionHostLegacyLink.release(runtimeDir, 'h-bbb');
    expect(fs.existsSync(legacy)).toBe(false);
    older.stop();

    // A real socket there is a pre-hosts host: never replaced while it is there.
    const server = net.createServer(() => undefined);
    await new Promise<void>((resolve) => server.listen(legacy, resolve));
    ExtensionHostLegacyLink.maintain(runtimeDir, 'h-bbb');
    expect(fs.lstatSync(legacy).isSymbolicLink()).toBe(false);
    await ExtensionHostLegacyLink.clearDead(runtimeDir);
    expect(fs.existsSync(legacy)).toBe(true);
    // Once that host is gone its socket file refuses — and the next host to start clears it.
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.writeFileSync(legacy, '');
    await ExtensionHostLegacyLink.clearDead(runtimeDir);
    expect(fs.existsSync(legacy)).toBe(false);
  }, 20_000);

  it('keeps every socket path under the Unix limit for the longest plugin id', () => {
    const dir = path.join('/run/fromcode', ExtensionHostSocket.hostDirName('0123456789abcdef'));
    const longest = path.join(dir, 'plugin-finance-payment-stripe.0123456789ab.99', 'host', 'channel.sock');
    expect(longest.length).toBeLessThan(104);
  });
});
