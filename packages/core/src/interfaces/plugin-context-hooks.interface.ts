/**
 * Cross-plugin event bus exposed on the plugin context. Handlers receive the
 * emitted payload and the event name; `call` collects handler return values.
 */
export interface IPluginContextHooks {
    on(event: string, handler: (payload: any, event?: string) => unknown): void;
    off(event: string, handler: (payload: any, event?: string) => unknown): void;
    emit(event: string, payload?: any): void;
    call(event: string, payload?: any): Promise<unknown>;
}