import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { SystemConstants } from '@core/constants/system.constants';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { SpawnerGuests } from '@core/process/spawner-guests';
import { ProcessEntry } from '@core/process/process-entry';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';
import { ExtensionHostLegacyLink } from '@core/process/extension-host/extension-host-legacy-link';

/**
 * The `extension-host` container: starts and supervises plugin processes for the api.
 *
 * The api used to fork this spawner itself, so every plugin process lived in the api's container, was
 * counted against the api's memory, and went with the api on every restart. Here it is its own
 * container, sharing only the runtime directory (`/run/fromcode`) with the api.
 *
 * Several can run at once — a deploy starts the next one beside this one — so everything this host owns
 * lives in its own directory (`ExtensionHostSocket`): it clears only that at start, never another
 * host's, and removes it when it stops. It used to clear the whole runtime directory, which would have
 * cut every running plugin of the host beside it off from its api.
 *
 * Who may connect: the socket is `root:<api group>` 0660 inside a root-owned directory, so the api's
 * user can and a plugin process — its own OS user, not in that group — cannot. Each connection gets its
 * own spawner, over ONE registry of processes: a new api takes over what the previous one started
 * (`SpawnerGuests`), and a process no api holds any more is stopped after a grace period.
 */
@ProcessEntry.start('extension-host')
export class ExtensionHostMain {
  private static readonly LEGACY_LINK_INTERVAL_MS = 3_000;

  static async main(): Promise<void> {
    const runtimeDir = SystemConstants.PROCESS_ISOLATION.RUNTIME_DIR;
    const gid = ExtensionHostSocket.groupId(SystemConstants.PROCESS_ISOLATION.RUN_AS_USER);
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o711 });
    // A volume's root arrives 0755: the api may enter it, but nobody may list whose processes run here.
    fs.chmodSync(runtimeDir, 0o711);
    // ...except the api may list which hosts there are.
    const hostsDir = path.join(runtimeDir, ExtensionHostSocket.HOSTS_DIR);
    fs.mkdirSync(hostsDir, { recursive: true });
    fs.chownSync(hostsDir, 0, gid);
    fs.chmodSync(hostsDir, 0o750);

    const hostDirName = ExtensionHostSocket.hostDirName(os.hostname());
    const hostDir = path.join(runtimeDir, hostDirName);
    // Only this host's own directory: a previous life of this container left socket directories of
    // processes that did not survive it. Another host's directory belongs to processes still running.
    fs.rmSync(hostDir, { recursive: true, force: true });
    fs.mkdirSync(hostDir, { mode: 0o711 });
    await ExtensionHostLegacyLink.clearDead(runtimeDir);

    const socketPath = path.join(hostDir, ExtensionHostSocket.FILE);
    // One registry for every api that connects: a new api takes over what the one before it started.
    const guests = new SpawnerGuests<PrivilegedSpawner>();
    let apis = 0;
    const server = net.createServer((socket) => {
      apis += 1;
      console.info(`[extension-host] an api connected (${apis} connected)`);
      socket.on('close', () => { apis -= 1; console.info(`[extension-host] an api disconnected; plugin processes no api holds stop in ${SpawnerGuests.ORPHAN_GRACE_MS / 1000} s unless one takes them over (${apis} connected)`); });
      void new PrivilegedSpawner(new SocketMessagePort(socket), hostDir, false, guests);
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    fs.chownSync(socketPath, 0, gid);
    fs.chmodSync(socketPath, 0o660);
    // Announced last, once it can be connected to: an api that finds the announcement finds a socket.
    const announcement = path.join(hostsDir, hostDirName);
    fs.writeFileSync(announcement, '');
    fs.chownSync(announcement, 0, gid);
    fs.chmodSync(announcement, 0o640);
    console.info(`[extension-host] listening on ${socketPath} (group ${gid}); pid ${process.pid}`);

    const legacyLink = setInterval(() => {
      try { ExtensionHostLegacyLink.maintain(runtimeDir, hostDirName); } catch (error) {
        console.warn(`[extension-host] could not point ${ExtensionHostSocket.FILE} at this host: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, ExtensionHostMain.LEGACY_LINK_INTERVAL_MS);
    legacyLink.unref();
    ExtensionHostLegacyLink.maintain(runtimeDir, hostDirName);

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        clearInterval(legacyLink);
        server.close();
        // Withdrawn first, so no api starts anything here while it goes.
        fs.rmSync(announcement, { force: true });
        ExtensionHostLegacyLink.release(runtimeDir, hostDirName);
        fs.rmSync(hostDir, { recursive: true, force: true });
        process.exit(0);
      });
    }
  }
}
