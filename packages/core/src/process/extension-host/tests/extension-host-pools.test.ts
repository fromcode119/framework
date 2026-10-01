import { afterAll, afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { ExtensionHostLink } from '@core/process/extension-host/extension-host-link';
import { ExtensionHostPool } from '@core/process/extension-host/extension-host-pool';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * A plugin a site uploaded runs in a host of its own — a sandbox — once the deployment runs one. Two REAL
 * spawner sockets laid out as `extension-host-main` lays them out: a platform host and a site host.
 */
describe('extension-host pools', () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pools-'));
  const legacy = path.join(runtimeDir, ExtensionHostSocket.FILE);
  const hostsDir = path.join(runtimeDir, ExtensionHostSocket.HOSTS_DIR);
  fs.mkdirSync(hostsDir);
  const stops: Array<() => void> = [];
  const env = process.env[ExtensionHostPool.SITE_REQUIRED_ENV];

  const host = async (name: string, pool: string) => {
    const dir = path.join(runtimeDir, name);
    fs.mkdirSync(dir);
    const socketPath = path.join(dir, ExtensionHostSocket.FILE);
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => { sockets.add(socket); void new PrivilegedSpawner(new SocketMessagePort(socket), dir, false); });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    const announcement = path.join(hostsDir, name);
    fs.writeFileSync(announcement, pool);
    const stop = () => { server.close(); for (const socket of sockets) socket.destroy(); fs.rmSync(announcement, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); };
    stops.push(stop);
    return { socketPath, stop };
  };

  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    for (const pool of [ExtensionHostPool.PLATFORM, ExtensionHostPool.SITE]) { SpawnerClient.publish(null, pool); SpawnerClient.publishUnavailable(null, pool); }
    if (env === undefined) delete process.env[ExtensionHostPool.SITE_REQUIRED_ENV]; else process.env[ExtensionHostPool.SITE_REQUIRED_ENV] = env;
  });
  afterAll(() => fs.rmSync(runtimeDir, { recursive: true, force: true }));

  it('reads each host\'s pool from its announcement — an empty one, from before pools, is the platform\'s', () => {
    fs.writeFileSync(path.join(hostsDir, 'h-old'), '');
    fs.writeFileSync(path.join(hostsDir, 'h-sandbox'), 'site');
    const pools = Object.fromEntries(ExtensionHostSocket.candidates(legacy).map((candidate) => [path.basename(path.dirname(candidate.socketPath)), candidate.pool]));
    expect(pools).toEqual({ 'h-old': 'platform', 'h-sandbox': 'site' });
    fs.rmSync(path.join(hostsDir, 'h-old'));
    fs.rmSync(path.join(hostsDir, 'h-sandbox'));
  });

  it('puts a site\'s plugin in the site pool only where the deployment runs one', () => {
    delete process.env[ExtensionHostPool.SITE_REQUIRED_ENV];
    expect(ExtensionHostPool.forPlugin(true)).toBe('platform');
    process.env[ExtensionHostPool.SITE_REQUIRED_ENV] = 'required';
    expect(ExtensionHostPool.forPlugin(true)).toBe('site');
    expect(ExtensionHostPool.forPlugin(false)).toBe('platform');
  });

  it('publishes each pool\'s host apart: a site plugin starts in the sandbox, a platform plugin beside the others', async () => {
    process.env[ExtensionHostPool.SITE_REQUIRED_ENV] = 'required';
    await host('h-platform', 'platform');
    await host('h-sandbox', 'site');
    const platform = await new ExtensionHostLink(legacy, () => undefined, 100).start(3_000);
    const site = SpawnerClient.current(ExtensionHostPool.SITE);
    expect(platform).not.toBeNull();
    expect(site).not.toBeNull();
    expect(site).not.toBe(platform);
    expect(SpawnerClient.current()).toBe(platform);
  }, 20_000);

  it('never starts a site\'s plugin beside the platform\'s when its sandbox is missing — it says why instead', async () => {
    process.env[ExtensionHostPool.SITE_REQUIRED_ENV] = 'required';
    await host('h-platform', 'platform');
    const lines: string[] = [];
    await new ExtensionHostLink(legacy, (line) => lines.push(line), 100).start(500);
    expect(SpawnerClient.current(ExtensionHostPool.SITE)).toBeNull();
    expect(GuestProcessLaunchers.unavailableReason(ExtensionHostPool.SITE)).toMatch(/sandboxed extension-host/);
    expect(GuestProcessLaunchers.current(ExtensionHostPool.SITE).constructor.name).toBe('UnavailableGuestLauncher');
    expect(GuestProcessLaunchers.unavailableReason()).toBeNull();
  }, 20_000);

  it('fails closed for the site pool even before any link ran — no quiet fork beside the api', () => {
    expect(GuestProcessLaunchers.unavailableReason(ExtensionHostPool.SITE)).toMatch(/sandboxed extension-host/);
    expect(GuestProcessLaunchers.current(ExtensionHostPool.SITE).constructor.name).toBe('UnavailableGuestLauncher');
  });
});
