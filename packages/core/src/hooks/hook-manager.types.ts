// ─── Companion types file for hook-manager.ts ───────────────────────────────

export type HookHandler = (payload: any, event: string) => any | Promise<any>;
