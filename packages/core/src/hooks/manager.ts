export type HookHandler = (payload: any) => void | Promise<void>;

export class HookManager {
  private handlers: Map<string, Set<HookHandler>> = new Map();

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
  emit(event: string, payload: any): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            result.catch(err => console.error(`[HookManager] Error in async handler for ${event}:`, err));
          }
        } catch (err) {
          console.error(`[HookManager] Error in handler for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Call a hook (sequential execution, can modify payload)
   * This is useful for filters like 'content.render'
   */
  async call<T = any>(event: string, payload: T): Promise<T> {
    const set = this.handlers.get(event);
    let currentPayload = payload;

    if (set) {
      for (const handler of set) {
        // In call mode, we await each handler
        const result = await handler(currentPayload);
        // If handler returns something, it becomes the new payload (filter pattern)
        if (result !== undefined) {
          currentPayload = result;
        }
      }
    }

    return currentPayload;
  }
}
