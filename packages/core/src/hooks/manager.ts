import { HookMessagingAdapter } from './types';
import { HookAdapterFactory } from './factory';

export type HookHandler = (payload: any, event: string) => any | Promise<any>;

export class HookManager {
  private handlers: Map<string, Set<HookHandler>> = new Map();
  private adapter: HookMessagingAdapter;

  constructor(options: { type?: string, redisUrl?: string, namespace?: string } = {}) {
    this.adapter = HookAdapterFactory.create(options.type, options);
    this.initDistributed();
  }

  private async initDistributed() {
    await this.adapter.subscribe((event, payload) => {
      this.emit(event, payload, true);
    });
  }

  /**
   * Subscribe to an event
   */
  on(event: string, handler: HookHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: HookHandler): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  /**
   * Emit an event (fire and forget)
   */
  emit(event: string, payload: any, skipDistributed: boolean = false): void {
    const handlersToCall = new Set<HookHandler>();

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

    // 3. Broadcast to other instances via adapter
    if (!skipDistributed) {
      this.adapter.publish(event, payload);
    }
  }

  /**
   * Call a hook (sequential execution, can modify payload)
   * This is useful for filters like 'content.render'
   */
  async call<T = any>(event: string, payload: T): Promise<T> {
    const handlersToCall = new Set<HookHandler>();

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
      const result = await handler(currentPayload, event);
      if (result !== undefined) {
        currentPayload = result;
      }
    }

    return currentPayload;
  }
}
