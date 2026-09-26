import fs from 'fs';
import net from 'net';
import path from 'path';
import { SystemConstants } from '@core/constants/system.constants';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { SpawnerGuests } from '@core/process/spawner-guests';
import { ProcessEntry } from '@core/process/process-entry';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';

/**
 * The `extension-host` container: starts and supervises plugin processes for the api.
 *
 * The api used to fork this spawner itself, so every plugin process lived in the api's container, was
 * counted against the api's memory, and went with the api on every restart. Here it is its own
 * container, sharing only the runtime directory (`/run/fromcode`) with the api: the api connects to
 * `spawner.sock` in it and asks for processes exactly as it asked its own child before.
 *
 * Who may connect: the socket is `root:<api group>` 0660 inside a root-owned directory, so the api's
 * user can and a plugin process — its own OS user, not in that group — cannot. That is the same
 * boundary the api's private IPC channel drew. Each connection gets its own spawner, over ONE registry
 * of processes: a new api takes over what the previous one started (`SpawnerGuests`), and a process no
 * api holds any more is stopped after a grace period.
 */
@ProcessEntry.start('extension-host')
export class ExtensionHostMain {
  static async main(): Promise<void> {
    const runtimeDir = SystemConstants.PROCESS_ISOLATION.RUNTIME_DIR;
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o711 });
    // A volume's root arrives 0755: the api may enter it, but nobody may list whose processes run here.
    fs.chmodSync(runtimeDir, 0o711);
    // The volume outlives this container, and so did the socket directories of every process the last
    // one ran — none of which survived it. Nothing in here belongs to a running process yet.
    for (const entry of fs.readdirSync(runtimeDir)) fs.rmSync(path.join(runtimeDir, entry), { recursive: true, force: true });
    const socketPath = path.join(runtimeDir, ExtensionHostSocket.FILE);
    // One registry for every api that connects: a new api takes over what the one before it started.
    const guests = new SpawnerGuests<PrivilegedSpawner>();
    let apis = 0;
    const server = net.createServer((socket) => {
      apis += 1;
      console.info(`[extension-host] an api connected (${apis} connected)`);
      socket.on('close', () => { apis -= 1; console.info(`[extension-host] an api disconnected; plugin processes no api holds stop in ${SpawnerGuests.ORPHAN_GRACE_MS / 1000} s unless one takes them over (${apis} connected)`); });
      void new PrivilegedSpawner(new SocketMessagePort(socket), runtimeDir, false, guests);
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    const gid = ExtensionHostSocket.groupId(SystemConstants.PROCESS_ISOLATION.RUN_AS_USER);
    fs.chownSync(socketPath, 0, gid);
    fs.chmodSync(socketPath, 0o660);
    console.info(`[extension-host] listening on ${socketPath} (group ${gid}); pid ${process.pid}`);
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { server.close(); process.exit(0); });
  }
}
