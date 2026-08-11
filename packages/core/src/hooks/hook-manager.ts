import { IHookMessagingAdapter } from '@core/hooks/interfaces/hook-messaging-adapter.interface';
import { HookAdapterFactory } from '@core/hooks/hook-adapter-factory';
import type { IHookHandler } from '@core/hooks/interfaces/hook-handler.interface';

export class HookManager {
  private handlers: Map<string, Set<IHookHandler>> = new Map();
  /**
   * Which handlers each OWNER (a plugin slug) registered, so they can be dropped as a group.
   *
   * `handlers` is a Set, which dedupes by function IDENTITY — and every plugin registers inline arrow
   * functions, a fresh object per call. So when a plugin re-initialised inside a live process its
   * hooks stacked instead of replacing, and one order sent two admin confirmation emails and
   * decremented stock twice. Untagged handlers (the manager's own webhook catch-all) are never
   * indexed here and so are never swept.
   */
  private ownedHandlers: Map<string, Array<{ event: string; handler: IHookHandler }>> = new Map();
  private adapter: IHookMessagingAdapter;

  constructor(options: { type?: string, redisUrl?: string, namespace?: string } = {}) {
    this.adapter = HookAdapterFactory.create(options.type, options);
    // A constructor cannot await, so this promise has no caller to reject to. With the Redis adapter,
    // an unreachable Redis at boot rejected here and — unobserved — killed the process under Node 22.
    // Log it instead: local hook delivery still works, only cross-instance broadcast is lost.
    this.initDistributed().catch(err =>
      console.error('[HookManager] Distributed hook subscription failed; hooks stay local to this instance:', err)
    );
  }

  private async initDistributed() {
    await this.adapter.subscribe((event, payload) => {
      this.emit(event, payload, true);
    });
  }

  /**
   * Subscribe to an event
   */
  on(event: string, handler: IHookHandler, owner?: string): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    if (!owner) return;
    if (!this.ownedHandlers.has(owner)) {
      this.ownedHandlers.set(owner, []);
    }
    this.ownedHandlers.get(owner)!.push({ event, handler });
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: IHookHandler): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
    // Drop it from the owner index too, so a later sweep cannot resurrect a stale reference.
    for (const [owner, entries] of this.ownedHandlers.entries()) {
      const remaining = entries.filter((entry) => entry.event !== event || entry.handler !== handler);
      if (remaining.length === entries.length) continue;
      if (remaining.length === 0) this.ownedHandlers.delete(owner);
      else this.ownedHandlers.set(owner, remaining);
    }
  }

  /**
   * Remove every handler registered under `owner`.
   *
   * Called before a plugin re-registers its hooks, so re-initialising a plugin inside a live process
   * REPLACES its handlers instead of stacking a second copy of all of them.
   */
  removeAllForOwner(owner: string): number {
    const entries = this.ownedHandlers.get(owner);
    if (!entries) return 0;

    for (const { event, handler } of entries) {
      const set = this.handlers.get(event);
      if (!set) continue;
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(event);
    }
    this.ownedHandlers.delete(owner);
    // Returned so the caller can SAY it happened: a re-init that silently replaces 15 handlers is
    // indistinguishable in the log from the cold boot that registers them for the first time.
    return entries.length;
  }

  /**
   * Emit an event (fire and forget)
   */
  emit(event: string, payload: any, skipDistributed: boolean = false): void {
    const handlersToCall = new Set<IHookHandler>();

    // 0. Catch-all handlers
    const globalHandlers = this.handlers.get('*');
    if (globalHandlers) {
      globalHandlers.forEach(h => handlersToCall.add(h));
    }

    // 1. Exact match
    const exactHandlers = this.handlers.get(event);
    if (exactHandlers) {
      exactHandlers.forEach(h => handlersToCall.add(h));
    }

    // 2. Wildcard match (e.g., collection:*:afterCreate)
    for (const [registeredEvent, set] of this.handlers.entries()) {
      if (registeredEvent.includes('*')) {
        const pattern = new RegExp('^' + registeredEvent.replace(/\./g, '\\.').replace(/\*/g, '[^:]+') + '$');
        if (pattern.test(event)) {
          set.forEach(h => handlersToCall.add(h));
        }
      }
    }

    for (const handler of handlersToCall) {
      try {
        const result = handler(payload, event);
        if (result instanceof Promise) {
          result.catch(err => console.error(`[HookManager] Error in async handler for ${event}:`, err));
        }
      } catch (err) {
        console.error(`[HookManager] Error in handler for ${event}:`, err);
      }
    }

    // 3. Broadcast to other instances via adapter.
    // `emit` is synchronous by contract, so the publish cannot be awaited — but it IS async with the
    // Redis adapter, so an unreachable Redis rejected here on EVERY emitted hook with nobody watching.
    if (!skipDistributed) {
      Promise.resolve(this.adapter.publish(event, payload)).catch(err =>
        console.error(`[HookManager] Failed to broadcast "${event}" to other instances:`, err)
      );
    }
  }

  /**
   * Call a hook (sequential execution, can modify payload)
   * This is useful for filters like 'content.render'
   */
  async call<T = any>(event: string, payload: T): Promise<T> {
    const handlersToCall = new Set<IHookHandler>();

    // Exact match
    const exactHandlers = this.handlers.get(event);
    if (exactHandlers) exactHandlers.forEach(h => handlersToCall.add(h));

    // Wildcard match
    for (const [registeredEvent, set] of this.handlers.entries()) {
      if (registeredEvent.includes('*')) {
        const pattern = new RegExp('^' + registeredEvent.replace(/\./g, '\\.').replace(/\*/g, '[^:]+') + '$');
        if (pattern.test(event)) set.forEach(h => handlersToCall.add(h));
      }
    }

    let currentPayload = payload;
    for (const handler of handlersToCall) {
      try {
        const result = await handler(currentPayload, event);
        if (result !== undefined) {
          currentPayload = result;
        }
      } catch (err) {
        // A filter that fails must NOT be swallowed — it was asked to vet or transform this payload and
        // did not, so letting the write proceed would publish unvetted data. Name the event first, then
        // rethrow: unnamed, this surfaced as an anonymous 500 with no clue which plugin refused.
        console.error(`[HookManager] Handler for "${event}" threw; aborting the hook chain:`, err);
        throw err;
      }
    }

    return currentPayload;
  }
}