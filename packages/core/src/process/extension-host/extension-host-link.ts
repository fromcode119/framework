import { SpawnerClient } from '@core/process/spawner-client';

/**
 * The api's connection to the `extension-host` container, kept up for the life of the api.
 *
 * Without it, one restart of that container — a crash, an image update — stopped every plugin process
 * and left the api holding a dead connection: each plugin burned its restart budget against nothing and
 * was marked failed until the api itself restarted. Here a lost connection is withdrawn at once (plugins
 * say why they are not running), retried until the container answers again, and published again — and a
 * plugin whose process went with it restarts then, not before.
 */
export class ExtensionHostLink {
  private static readonly RETRY_FOREVER_MS = Number.POSITIVE_INFINITY;

  constructor(private readonly socketPath: string, private readonly log: (line: string) => void) {}

  /** The spawner, or null when it did not answer within `waitMs` — then the link keeps trying. */
  async start(waitMs: number): Promise<SpawnerClient | null> {
    try {
      const client = await SpawnerClient.connect(this.socketPath, waitMs);
      this.attach(client);
      return client;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      SpawnerClient.publishUnavailable(reason);
      this.log(`${reason}; plugin processes start once it answers`);
      void this.reconnect();
      return null;
    }
  }

  private attach(client: SpawnerClient): void {
    client.onDisconnect(() => {
      SpawnerClient.publish(null);
      SpawnerClient.publishUnavailable(`lost the connection to extension-host at ${this.socketPath}; reconnecting`);
      this.log(`lost the connection to extension-host at ${this.socketPath}; its plugin processes stopped; reconnecting`);
      void this.reconnect();
    });
    SpawnerClient.publishUnavailable(null);
    SpawnerClient.publish(client);
  }

  private async reconnect(): Promise<void> {
    const client = await SpawnerClient.connect(this.socketPath, ExtensionHostLink.RETRY_FOREVER_MS);
    this.attach(client);
    this.log(`connected to extension-host at ${this.socketPath} (spawner pid ${client.pid})`);
  }
}
