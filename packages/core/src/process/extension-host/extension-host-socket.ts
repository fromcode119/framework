import fs from 'fs';
import path from 'path';
import { ExtensionHostPool } from '@core/process/extension-host/extension-host-pool';

/**
 * Where the api finds the `extension-host` containers, and who may connect to them.
 *
 * There can be more than one: a deploy starts the next extension-host BESIDE the running one, the api
 * moves every plugin to it with the same gapless swap a plugin update uses, and only then is the old one
 * removed. So each host keeps everything in a directory of its own (`h-<container>/`) — its socket and
 * the socket directories of the processes it runs — and announces itself with a file in `hosts/`. The
 * runtime directory itself may not be listed by the api (nobody may see whose processes run there), so
 * `hosts/` is the one place it can: `root:<api group>` 0750.
 *
 * `spawner.sock` at the top is the path apis from before this knew. A pre-hosts extension-host listens
 * there itself; otherwise the newest host keeps it as a link to its own socket (`ExtensionHostLegacyLink`),
 * so rolling back to such an api still finds a host.
 */
export class ExtensionHostSocket {
  static readonly FILE = 'spawner.sock';
  /** Set on the api to the top-level `spawner.sock`; the hosts are found next to it. */
  static readonly ENV = 'EXTENSION_HOST_SOCKET';
  static readonly HOSTS_DIR = 'hosts';
  private static readonly HOST_DIR_PREFIX = 'h-';

  /** The numeric group of `user` from /etc/group — the api's group, the only one allowed to connect. */
  static groupId(user: string, groupFile = '/etc/group'): number {
    const line = fs.readFileSync(groupFile, 'utf8').split('\n').find((entry) => entry.split(':')[0] === user);
    const gid = line ? Number(line.split(':')[2]) : NaN;
    if (!Number.isInteger(gid)) throw new Error(`extension-host: no group "${user}" in ${groupFile}`);
    return gid;
  }

  /**
   * A host's directory name, from its container's hostname. Short on purpose: every plugin process's
   * sockets live under it, and a Unix socket path must stay under ~104 bytes.
   */
  static hostDirName(hostname: string): string {
    return ExtensionHostSocket.HOST_DIR_PREFIX + (String(hostname).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'host');
  }

  static isHostDirName(name: string): boolean {
    return /^h-[a-z0-9]{1,12}$/.test(name);
  }

  /**
   * Every extension-host an api can reach from `legacySocket`'s directory, oldest first. A host's age is
   * its `hosts/` announcement's mtime; a pre-hosts host listening at the top-level path is the oldest of
   * all. A top-level LINK is skipped: it points at a host that is already listed.
   */
  static candidates(legacySocket: string): Array<{ socketPath: string; birth: number; pool: string }> {
    const runtimeDir = path.dirname(legacySocket);
    const found: Array<{ socketPath: string; birth: number; pool: string }> = [];
    try {
      const legacy = fs.lstatSync(legacySocket);
      if (!legacy.isSymbolicLink()) found.push({ socketPath: legacySocket, birth: 0, pool: ExtensionHostPool.PLATFORM });
    } catch { /* no pre-hosts host */ }
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(path.join(runtimeDir, ExtensionHostSocket.HOSTS_DIR));
    } catch { /* no host has announced itself yet */ }
    for (const entry of entries.filter((name) => ExtensionHostSocket.isHostDirName(name))) {
      try {
        const announcement = path.join(runtimeDir, ExtensionHostSocket.HOSTS_DIR, entry);
        const birth = fs.statSync(announcement).mtimeMs;
        // An announcement from before pools is empty: a platform host.
        const pool = ExtensionHostPool.of(fs.readFileSync(announcement, 'utf8'));
        found.push({ socketPath: path.join(runtimeDir, entry, ExtensionHostSocket.FILE), birth, pool });
      } catch { /* withdrawn while we looked */ }
    }
    return found.sort((left, right) => left.birth - right.birth);
  }
}
