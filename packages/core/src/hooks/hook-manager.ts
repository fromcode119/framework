import { IHookMessagingAdapter } from '@core/hooks/interfaces/hook-messaging-adapter.interface';
import { HookAdapterFactory } from '@core/hooks/hook-adapter-factory';
import type { IHookHandler } from '@core/hooks/interfaces/hook-handler.interface';

export class HookManager {
  private handlers: Map<string, Set<IHookHandler>> = new Map();
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
  on(event: string, handler: IHookHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: IHookHandler): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
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