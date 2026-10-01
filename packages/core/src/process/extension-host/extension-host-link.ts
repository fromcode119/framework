import { SpawnerClient } from '@core/process/spawner-client';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';
import { ExtensionHostPool } from '@core/process/extension-host/extension-host-pool';

/**
 * The api's connections to the `extension-host` containers, kept up for the life of the api.
 *
 * It holds one connection per host it finds (`ExtensionHostSocket.candidates`) and publishes the NEWEST
 * as the one new plugin processes start in. A deploy starts the next host beside the running one: the
 * link finds it on its next scan, publishes it, and the plugin hosts move their processes over with a
 * gapless swap each (`SpawnerClient.onChange`) — the old host is removed only once nothing runs there.
 *
 * Losing a host that another one outlives changes nothing for the plugins: the processes that were
 * still on it restart on the other. Losing the last one is the outage it always was — withdrawn at once
 * (plugins say why they are not running), retried until a host answers again, and published again.
 */
export class ExtensionHostLink {
  private static readonly SCAN_MS = 2_000;
  private static readonly START_POLL_MS = 250;

  private readonly connected = new Map<string, { client: SpawnerClient; birth: number; pool: string }>();
  private readonly connecting = new Set<string>();
  private lastFailure = 'no extension-host has announced itself';

  constructor(private readonly socketPath: string, private readonly log: (line: string) => void, private readonly scanMs = ExtensionHostLink.SCAN_MS) {}

  /** The newest platform host, or null when none answered within `waitMs` — then the link keeps trying. */
  async start(waitMs: number): Promise<SpawnerClient | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      await this.scan();
      // Only the platform's host is waited for. Without the sites' sandbox the api must still start the
      // platform's plugins at once — waiting for it held every boot for the whole wait, and a site's plugin
      // starts as soon as the sandbox appears on a later scan (until then it says why it is not running).
      if (this.newest(ExtensionHostPool.PLATFORM) || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, ExtensionHostLink.START_POLL_MS));
    }
    const scanning = setInterval(() => { void this.scan(); }, this.scanMs);
    scanning.unref();
    for (const pool of this.pools()) {
      if (this.newest(pool)) continue;
      const reason = pool === ExtensionHostPool.PLATFORM
        ? `extension-host unreachable at ${this.socketPath}: ${this.lastFailure}`
        : `the sandboxed extension-host for plugins sites upload has not announced itself in ${this.socketPath}`;
      SpawnerClient.publishUnavailable(reason, pool);
      this.log(`${reason}; ${pool} plugin processes start once it answers`);
    }
    return this.newest(ExtensionHostPool.PLATFORM);
  }

  /** The pools this api starts plugins in: the platform's, and the sites' own when the deployment runs one. */
  private pools(): string[] {
    return ExtensionHostPool.siteRequired() ? [ExtensionHostPool.PLATFORM, ExtensionHostPool.SITE] : [ExtensionHostPool.PLATFORM];
  }

  /** Connects to every host it can see and is not connected to yet. */
  private async scan(): Promise<void> {
    const candidates = ExtensionHostSocket.candidates(this.socketPath);
    await Promise.all(candidates
      .filter((candidate) => !this.connected.has(candidate.socketPath) && !this.connecting.has(candidate.socketPath))
      .map(async (candidate) => {
        this.connecting.add(candidate.socketPath);
        try {
          const client = await SpawnerClient.connect(candidate.socketPath, 0);
          this.attach(client, candidate.socketPath, candidate.birth, candidate.pool);
          this.log(`connected to extension-host at ${candidate.socketPath} (${candidate.pool} plugins, spawner pid ${client.pid})`);
        } catch (error) {
          this.lastFailure = error instanceof Error ? error.message : String(error);
        } finally {
          this.connecting.delete(candidate.socketPath);
        }
      }));
  }

  private attach(client: SpawnerClient, socketPath: string, birth: number, pool: string): void {
    this.connected.set(socketPath, { client, birth, pool });
    client.onDisconnect(() => {
      this.connected.delete(socketPath);
      const next = this.newest(pool);
      if (next) {
        this.log(`lost the connection to extension-host at ${socketPath}; new plugin processes start in the one that remains, and any still running there start again in it (${pool} plugins)`);
        this.publish(pool);
        return;
      }
      SpawnerClient.publish(null, pool);
      SpawnerClient.publishUnavailable(`lost the connection to extension-host at ${socketPath}; reconnecting`, pool);
      this.log(`lost the connection to extension-host at ${socketPath}; its plugin processes stopped; reconnecting (${pool} plugins)`);
    });
    this.publish(pool);
  }

  /** The newest connected host of `pool` becomes the one its new processes start in. */
  private publish(pool: string): void {
    const newest = this.newest(pool);
    if (!newest || newest === SpawnerClient.current(pool)) return;
    SpawnerClient.publishUnavailable(null, pool);
    SpawnerClient.publish(newest, pool);
  }

  private newest(pool: string): SpawnerClient | null {
    let best: { client: SpawnerClient; birth: number } | null = null;
    for (const entry of this.connected.values()) if (entry.pool === pool && (!best || entry.birth >= best.birth)) best = entry;
    return best?.client ?? null;
  }
}
