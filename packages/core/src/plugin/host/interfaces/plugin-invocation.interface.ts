/**
 * The host asking the guest to run one of the functions it registered (or a lifecycle hook).
 *
 * `token` is what the guest must present on every call it makes back while doing this work; the host
 * minted it for exactly this invocation. `tenantId`/`locale` are INFORMATIONAL — the guest's own
 * `RequestContextUtils` store is filled with them so plugin code that reads the tenant for display
 * keeps working — but they authorise nothing: the host resolves the token, not these fields.
 */
export interface IPluginInvocation {
  /** A `PluginInvocationKind` VALUE — the message is serialised, so it travels as its string. */
  kind: string;
  handlerId?: string;
  /** lifecycle: onInstall | onInit | onUpdate | onEnable | onDisable | onUninstall; public-api: the function name */
  name?: string;
  args?: unknown[];
  token: string;
  tenantId: string | null;
  locale: string;
  /** The bound site's own default locale ('' when none) — what `context.i18n.defaultLocale()` answers. */
  siteLocale: string;
  /** Which peer plugin APIs exist right now (`ns:slug` → function names) and which are enabled for this tenant. */
  peers: Record<string, string[]>;
  enabledPlugins: string[];
}
