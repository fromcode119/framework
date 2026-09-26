// Server-only SDK exports — for use in plugin API route files only.
// Never import from this path in React components or client-side code.
// These exports transitively depend on express, fs, path, or server-only @fromcode119/* packages.
//
// Every plugin process imports this file, so it must stay light: the core classes come from
// `@fromcode119/core/plugin-server`, which names one module per class, never from the core index. The
// api's own internals (`APIServer`, `AuthManager`, `PluginManager`, `ThemeManager`, `IntegrationManager`)
// are deliberately not here: no plugin or theme used them, an isolated plugin process would only get an
// empty copy of each, and importing the api for them cost about 70 MB in every plugin process.
export { BasePluginRouter, BaseRouter, BaseController, AccessLevel, EnvConfig, EnvUtils, PluginHealthResponseBuilder, PluginHealthRouteHandler, Plugins, Logger, ProjectPaths, RequestContextUtils, MediaPathUtils, OutboundUrlSecurityPolicy, NetworkAddressUtils } from '@fromcode119/core/plugin-server';

export type { IBasePluginRouterOptions, IPluginHealthBuildOptions, IPluginHealthIdentity, IPluginHealthProbeResult, IPluginHealthResponse, IPluginHealthRouteHandlerOptions, PluginHealthStatus, IRequestStore } from '@fromcode119/core/plugin-server';

// Server-only core services must be REGISTERED before `CoreServices.defaultPageContracts` (and the
// other server-side registries) can be reached. `ServerCoreServices.register()` is called explicitly
// at API boot and is deliberately not a barrel side effect, so anything running outside the API —
// a plugin's own test suite, a script — has to call it too. Without this export the only way to do
// that was importing `@fromcode119/core` directly, which the SDK boundary forbids for plugins.
export { ServerCoreServices } from '@fromcode119/core/plugin-server';

// The platform's per-install HMAC signing key, framework-owned. Plugins that mint capability links
// (booking manage tokens, unsubscribe links) MUST derive their key from this and never carry a
// literal fallback — see SigningSecretService.
export { SigningSecretService } from '@fromcode119/core/plugin-server';

// The framework's ONE revocable/expiring/countable token. A plugin that issues a share link stores
// `GrantTokenService.hash(raw)` on its own row and asks `GrantTokenService.evaluate` whether the link is
// still good — it does not reimplement expiry, revocation and usage caps, and it never reaches into the
// framework's own `_system_file_grants` table. `SigningSecretService` above is the other half of the
// choice: sign when the link must be stateless, mint a row when it must be revocable.
export { GrantTokenService, GrantOutcome } from '@fromcode119/core/plugin-server';
export type { IGrantEvaluable } from '@fromcode119/core/plugin-server';

// URL redirects are FRAMEWORK-owned (`_system_redirects`, migration 019) — routing is framework
// territory, and the capability used to be duplicated in two plugins. A theme or plugin
// that retires a path seeds its 301 through this service rather than reaching into the system table,
// which the plugin/theme boundary forbids outright.
export { SystemRedirectService } from '@fromcode119/core/plugin-server';

export { PluginRegistry } from '@fromcode119/plugins';
export { MediaImageOptimizer } from '@fromcode119/media';
export type { IMediaImageOptimizationOptions, IMediaImageOptimizationResult } from '@fromcode119/media';
