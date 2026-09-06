/**
 * The host asking the guest to run one of the functions it registered (or a lifecycle hook).
 *
 * `token` is what the guest must present on every call it makes back while doing this work; the host
 * minted it for exactly this invocation. `tenantId`/`locale` are INFORMATIONAL — the guest's own
 * `RequestContextUtils` store is filled with them so plugin code that reads the tenant for display
 * keeps working — but they authorise nothing: the host resolves the token, not these fields.
 */
export interface IPluginInvocation {
  /** `callback`: a function the guest handed out inside a payload, called by whoever received it. */
  kind: 'lifecycle' | 'hook' | 'scheduler' | 'job' | 'mcp-tool' | 'gate' | 'canonical-path' | 'public-api' | 'callback';
  handlerId?: string;
  /** lifecycle: onInstall | onInit | onUpdate | onEnable | onDisable | onUninstall; public-api: the function name */
  name?: string;
  args?: unknown[];
  token: string;
  tenantId: string | null;
  locale: string;
  /** Which peer plugin APIs exist right now (`ns:slug` → function names) and which are enabled for this tenant. */
  peers: Record<string, string[]>;
  enabledPlugins: string[];
}
