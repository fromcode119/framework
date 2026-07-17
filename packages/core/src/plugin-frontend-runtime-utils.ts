/**
 * Answers ONE question about a plugin descriptor: does the storefront app load a frontend runtime
 * module for this plugin?
 *
 * It matters for the plugin API registry. A plugin whose runtime module is loaded registers its OWN
 * API client when that module evaluates (`ContextBridge.registerPluginClient(...)`), and that client
 * is the plugin's real, method-rich contract (`ecommerce.storefront(...)`, `.cartStore()`, ...).
 *
 * Until that module lands the framework must leave the plugin's registry key EMPTY rather than fill
 * it with a generic `ApiScopeClient` stand-in. The stand-in only implements the bare REST surface
 * (`get`/`post`/...), yet it is truthy — so a consumer doing the correct presence check
 * (`const api = plugins.get('ecommerce'); if (!api) return fallback;`) sails past the guard and then
 * throws on `api.storefront(...)` ("is not a function"). "Absent" is a state consumers already
 * handle; "present but not really the plugin's API" is a lie no consumer can defend against.
 *
 * This mirrors the load decision in the frontend's PluginLoader (`loadPluginRuntimes`) — the two MUST
 * agree, so both call this. A plugin that ships no frontend runtime (or is opted out via
 * `loadStrategy: 'none'` / a capability set without `frontend`) never self-registers, so the generic
 * fallback client remains correct for it.
 */
export class PluginFrontendRuntimeUtils {
  static readonly FRONTEND_CAPABILITY = 'frontend';

  static loadsOwnFrontendRuntime(plugin: unknown): boolean {
    const descriptor = (plugin ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ui = (descriptor.ui ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Frontend-only plugins ship just a `frontendEntry`; others reuse the admin `entry`.
    const entryFile = String(ui.frontendEntry || ui.entry || '').trim();
    if (!entryFile) {
      return false;
    }

    // An explicit capability list that omits `frontend` means the storefront never loads it.
    const capabilities: unknown[] = Array.isArray(descriptor.capabilities) ? descriptor.capabilities : [];
    if (capabilities.length > 0 && !capabilities.includes(PluginFrontendRuntimeUtils.FRONTEND_CAPABILITY)) {
      return false;
    }

    return String(ui.loadStrategy || 'eager').trim() !== 'none';
  }
}
