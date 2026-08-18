/**
 * The canonical in-plugin collection WRITE path (Plan 3, Task 2).
 *
 * A plugin-side `context.db.update` on a collection row is a raw write: none of the collection
 * lifecycle hooks fire, so downstream listeners (licence minting, ledger writes, search indexing) silently never run — the
 * write is real and its side effects are absent. The admin's own saves go through the api's REST
 * controller, where those hooks DO fire.
 *
 * Core cannot import the api, so the api PUSHES its controller-backed writer in here at boot — the
 * same inversion as `McpRegistryProvider`. `context.collections.update()` forwards through this
 * bridge, which means a plugin write IS an admin save: same access policy, same validation, same
 * hooks. Fail-closed: before the api installs the writer, writes throw rather than fall back to a
 * hook-less path.
 */
export class CollectionWriteBridge {
  private static writer:
    | ((collectionSlug: string, id: number | string, data: Record<string, unknown>, actor: unknown) => Promise<unknown>)
    | null = null;

  static install(writer: (collectionSlug: string, id: number | string, data: Record<string, unknown>, actor: unknown) => Promise<unknown>): void {
    CollectionWriteBridge.writer = writer;
  }

  static async update(collectionSlug: string, id: number | string, data: Record<string, unknown>, actor: unknown): Promise<unknown> {
    if (!CollectionWriteBridge.writer) {
      throw new Error('Collection writes are unavailable: the api installs the collection write bridge at boot, and it has not run.');
    }
    return CollectionWriteBridge.writer(collectionSlug, id, data, actor);
  }
}
