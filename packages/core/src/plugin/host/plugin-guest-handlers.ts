import { randomUUID } from 'crypto';

/**
 * The functions the plugin handed the framework, kept on the guest side under ids.
 *
 * Hook handlers, scheduled tasks, job processors, MCP tool handlers, resolution gates — the host
 * holds a forwarding stand-in for each and asks for `handlerId` by id when it fires. Nothing about
 * the function itself ever crosses the channel.
 */
export class PluginGuestHandlers {
  private readonly handlers = new Map<string, (...args: any[]) => unknown>();
  private readonly stableIds = new Map<(...args: any[]) => unknown, string>();
  private stableCounter = 0;

  /**
   * A function that crosses INSIDE a payload (a provider's `search`, a collection's `access.read`) —
   * kept under an id that is the same function → same id, and numbered in registration order, so a
   * restarted guest that re-runs the same `onInit` hands out the same ids and the host's stand-ins
   * from before the restart still reach the right function.
   */
  keepStable(handler: (...args: any[]) => unknown): string {
    const existing = this.stableIds.get(handler);
    if (existing) return existing;
    this.stableCounter += 1;
    const id = `callback:${this.stableCounter}`;
    this.stableIds.set(handler, id);
    this.handlers.set(id, handler);
    return id;
  }

  keep(kind: string, handler: (...args: any[]) => unknown): string {
    const id = `${kind}:${randomUUID()}`;
    this.handlers.set(id, handler);
    return id;
  }

  /** The id under which `handler` was kept, so `hooks.off(event, handler)` can name it to the host. */
  idOf(handler: unknown): string | null {
    for (const [id, kept] of this.handlers) {
      if (kept === handler) return id;
    }
    return null;
  }

  take(id: string): ((...args: any[]) => unknown) | null {
    return this.handlers.get(id) ?? null;
  }

  forget(id: string): void {
    this.handlers.delete(id);
  }
}
