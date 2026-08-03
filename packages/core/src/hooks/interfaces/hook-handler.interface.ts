// ─── Companion types file for hook-manager.ts ───────────────────────────────

export interface IHookHandler {
  (payload: any, event: string): any | Promise<any>;
}
