import fs from 'fs';
import net from 'net';
import path from 'path';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';

/**
 * Keeps the top-level `spawner.sock` — the one path apis from before `hosts/` know — pointing at the
 * newest extension-host, so rolling back to such an api still finds a host to start plugins in.
 *
 * A pre-hosts extension-host listens at that path itself, and it is left alone while it answers. Once it
 * is gone, the newest host replaces the path with a link to its own socket, and clears what the old host
 * left in the directory (it kept each process's sockets at the top level, and nothing runs there now).
 */
export class ExtensionHostLegacyLink {
  private static readonly PROBE_TIMEOUT_MS = 1_000;

  /** At a host's start: a top-level socket that refuses is a pre-hosts host that is gone — drop it. */
  static async clearDead(runtimeDir: string): Promise<void> {
    const legacy = path.join(runtimeDir, ExtensionHostSocket.FILE);
    let stats: fs.Stats;
    try { stats = fs.lstatSync(legacy); } catch { return; }
    if (stats.isSymbolicLink()) return;
    if (!(await ExtensionHostLegacyLink.answers(legacy))) fs.rmSync(legacy, { force: true });
  }

  /** Called periodically by every host; only the newest one acts. */
  static maintain(runtimeDir: string, ownDirName: string): void {
    const legacy = path.join(runtimeDir, ExtensionHostSocket.FILE);
    let stats: fs.Stats | null = null;
    try { stats = fs.lstatSync(legacy); } catch { stats = null; }
    // A pre-hosts extension-host holds the path: it is the one older apis use until it goes.
    if (stats && !stats.isSymbolicLink()) return;
    if (ExtensionHostLegacyLink.newest(runtimeDir) !== ownDirName) return;
    const target = path.join(ownDirName, ExtensionHostSocket.FILE);
    if (stats && fs.readlinkSync(legacy) === target) return;
    const staging = `${legacy}.${ownDirName}`;
    fs.rmSync(staging, { force: true });
    fs.symlinkSync(target, staging);
    fs.renameSync(staging, legacy);
    if (!stats) ExtensionHostLegacyLink.clearLeftovers(runtimeDir);
  }

  /** At a host's graceful stop: the link must not outlive the socket it points at. */
  static release(runtimeDir: string, ownDirName: string): void {
    const legacy = path.join(runtimeDir, ExtensionHostSocket.FILE);
    try {
      if (fs.lstatSync(legacy).isSymbolicLink() && fs.readlinkSync(legacy) === path.join(ownDirName, ExtensionHostSocket.FILE)) fs.rmSync(legacy, { force: true });
    } catch { /* nothing there */ }
  }

  /** The announced host whose socket exists, newest first — the one new processes start in. */
  static newest(runtimeDir: string): string | null {
    const hosts = ExtensionHostSocket.candidates(path.join(runtimeDir, ExtensionHostSocket.FILE))
      .filter((candidate) => path.dirname(candidate.socketPath) !== runtimeDir && fs.existsSync(candidate.socketPath));
    return hosts.length ? path.basename(path.dirname(hosts[hosts.length - 1].socketPath)) : null;
  }

  /** What a pre-hosts extension-host left at the top level: every entry but the hosts' own. */
  private static clearLeftovers(runtimeDir: string): void {
    for (const entry of fs.readdirSync(runtimeDir)) {
      if (entry === ExtensionHostSocket.HOSTS_DIR || entry === ExtensionHostSocket.FILE || ExtensionHostSocket.isHostDirName(entry) || entry.startsWith(`${ExtensionHostSocket.FILE}.`)) continue;
      fs.rmSync(path.join(runtimeDir, entry), { recursive: true, force: true });
    }
  }

  private static answers(socketPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect(socketPath);
      const done = (alive: boolean) => { socket.destroy(); resolve(alive); };
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
      socket.setTimeout(ExtensionHostLegacyLink.PROBE_TIMEOUT_MS, () => done(false));
    });
  }
}
