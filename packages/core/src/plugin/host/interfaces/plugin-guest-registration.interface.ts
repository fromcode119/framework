/**
 * The guest telling the host "I registered something that the host must forward to me".
 *
 * These are the six places where a FUNCTION crosses the contract: the guest keeps the function under
 * `handlerId` and the host registers a forwarding stand-in on the real context. Routes carry no
 * handler id — the host forwards them over HTTP to the guest's socket by path.
 */
export interface IPluginGuestRegistration {
  /** `plugins-on`: `context.plugins.on(event)` — the platform bus (`plugins:ready`), NOT the tenant-gated plugin hooks. */
  kind: 'route' | 'use' | 'middleware' | 'hook' | 'hook-off' | 'plugins-on' | 'scheduler' | 'job-worker' | 'mcp-tools' | 'gate' | 'canonical-path';
  handlerId?: string;
  /** route / use */
  method?: string;
  path?: string;
  access?: unknown;
  /** middleware */
  middleware?: { id: string; priority?: number; stage: string };
  /** hook */
  event?: string;
  /** scheduler */
  name?: string;
  schedule?: string;
  options?: Record<string, unknown>;
  /** mcp-tools: the tool definitions with `handlerId` in place of `handler` */
  tools?: Array<Record<string, unknown> & { handlerId: string }>;
  /** gate / canonical-path registry key */
  key?: string;
}
