import type { MediaManager } from '@fromcode119/media';

/** What framework MCP tools need from the running server. */
export interface IMcpToolDependencies {
  db: any;
  mediaManager: MediaManager;
  /** The plugin manager's hook bus — cache.purge fires the framework purge event through it. */
  hooks: { call: (event: string, payload: Record<string, unknown>) => Promise<unknown> };
  /** Server logger — deploy.restart announces who asked before the process exits. */
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}
