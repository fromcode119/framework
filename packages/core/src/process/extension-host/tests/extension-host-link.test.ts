import { afterAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { ExtensionHostLink } from '@core/process/extension-host/extension-host-link';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * The api's link to a REAL spawner socket, served the way `extension-host-main` serves it, through the
 * container going away and coming back.
 */
describe('ExtensionHostLink', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-link-'));
  const socketPath = path.join(dir, 'spawner.sock');
  const lines: string[] = [];

  /** One `extension-host`: a spawner per connection; `stop()` is the container going away. */
  const serve = async () => {
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      void new PrivilegedSpawner(new SocketMessagePort(socket), dir, false);
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    return { stop: () => { server.close(); for (const socket of sockets) socket.destroy(); fs.rmSync(socketPath, { force: true }); } };
  };

  afterAll(() => {
    SpawnerClient.publish(null);
    SpawnerClient.publishUnavailable(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports every guest gone, waits, and reconnects when the extension-host comes back', async () => {
    const first = await serve();
    const client = await new ExtensionHostLink(socketPath, (line) => lines.push(line)).start(5_000);
    expect(client).not.toBeNull();
    expect(SpawnerClient.current()).toBe(client);
    expect(client!.hostedBy).toBe(SpawnerClient.HOSTED_BY_EXTENSION_HOST);

    const exits: Array<string | null> = [];
    client!.onExit('plugin-probe.api.1', (_code, signal) => {
      exits.push(signal);
      // What a plugin's restart sees at this moment: nothing to start it with, and why.
      exits.push(GuestProcessLaunchers.unavailableReason());
    });

    first.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(exits[0]).toBe(SpawnerClient.DISCONNECTED);
    expect(exits[1]).toContain('lost the connection to extension-host');
    expect(SpawnerClient.current()).toBeNull();

    const back = GuestProcessLaunchers.whenAvailable();
    const second = await serve();
    await back;
    expect(SpawnerClient.current()).not.toBeNull();
    expect(SpawnerClient.current()).not.toBe(client);
    expect(GuestProcessLaunchers.unavailableReason()).toBeNull();
    expect(lines.some((line) => line.startsWith('connected to extension-host'))).toBe(true);
    second.stop();
  }, 20_000);

  it('starts the api anyway when the extension-host never answers, and says why', async () => {
    fs.rmSync(socketPath, { force: true });
    SpawnerClient.publish(null);
    const client = await new ExtensionHostLink(path.join(dir, 'absent.sock'), (line) => lines.push(line)).start(200);
    expect(client).toBeNull();
    expect(GuestProcessLaunchers.unavailableReason()).toContain('extension-host unreachable');
    expect(GuestProcessLaunchers.current().constructor.name).toBe('UnavailableGuestLauncher');
  });
});
