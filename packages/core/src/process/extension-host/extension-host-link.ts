import { SpawnerClient } from '@core/process/spawner-client';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';

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

  private readonly connected = new Map<string, { client: SpawnerClient; birth: number }>();
  private readonly connecting = new Set<string>();
  private lastFailure = 'no extension-host has announced itself';

  constructor(private readonly socketPath: string, private readonly log: (line: string) => void, private readonly scanMs = ExtensionHostLink.SCAN_MS) {}

  /** The newest host, or null when none answered within `waitMs` — then the link keeps trying. */
  async start(waitMs: number): Promise<SpawnerClient | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      await this.scan();
      if (this.connected.size || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, ExtensionHostLink.START_POLL_MS));
    }
    const scanning = setInterval(() => { void this.scan(); }, this.scanMs);
    scanning.unref();
    const current = this.newest();
    if (!current) {
      const reason = `extension-host unreachable at ${this.socketPath}: ${this.lastFailure}`;
      SpawnerClient.publishUnavailable(reason);
      this.log(`${reason}; plugin processes start once it answers`);
    }
    return current;
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
          this.attach(client, candidate.socketPath, candidate.birth);
          this.log(`connected to extension-host at ${candidate.socketPath} (spawner pid ${client.pid})`);
        } catch (error) {
          this.lastFailure = error instanceof Error ? error.message : String(error);
        } finally {
          this.connecting.delete(candidate.socketPath);
        }
      }));
  }

  private attach(client: SpawnerClient, socketPath: string, birth: number): void {
    this.connected.set(socketPath, { client, birth });
    client.onDisconnect(() => {
      this.connected.delete(socketPath);
      const next = this.newest();
      if (next) {
        this.log(`lost the connection to extension-host at ${socketPath}; its plugin processes stopped and start again in the one that remains`);
        this.publish();
        return;
      }
      SpawnerClient.publish(null);
      SpawnerClient.publishUnavailable(`lost the connection to extension-host at ${socketPath}; reconnecting`);
      this.log(`lost the connection to extension-host at ${socketPath}; its plugin processes stopped; reconnecting`);
    });
    this.publish();
  }

  /** The newest connected host becomes the one new processes start in. */
  private publish(): void {
    const newest = this.newest();
    if (!newest || newest === SpawnerClient.current()) return;
    SpawnerClient.publishUnavailable(null);
    SpawnerClient.publish(newest);
  }

  private newest(): SpawnerClient | null {
    let best: { client: SpawnerClient; birth: number } | null = null;
    for (const entry of this.connected.values()) if (!best || entry.birth >= best.birth) best = entry;
    return best?.client ?? null;
  }
}
