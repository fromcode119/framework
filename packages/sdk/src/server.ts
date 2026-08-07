// Server-only SDK exports — for use in plugin API route files only.
// Never import from this path in React components or client-side code.
// These exports transitively depend on express, fs, path, or server-only @fromcode119/* packages.
export { APIServer } from '@fromcode119/api';
export { AuthManager } from '@fromcode119/auth';
export { BasePluginRouter, BaseRouter, BaseController, AccessLevel, EnvConfig, EnvUtils, PluginHealthResponseBuilder, PluginHealthRouteHandler, PluginManager, Plugins, ThemeManager, Logger, ProjectPaths, IntegrationManager, RequestContextUtils, MediaPathUtils } from '@fromcode119/core';

export type { IBasePluginRouterOptions, IPluginHealthBuildOptions, IPluginHealthIdentity, IPluginHealthProbeResult, IPluginHealthResponse, IPluginHealthRouteHandlerOptions, PluginHealthStatus, IRequestStore } from '@fromcode119/core';

// Server-only core services must be REGISTERED before `CoreServices.defaultPageContracts` (and the
// other server-side registries) can be reached. `ServerCoreServices.register()` is called explicitly
// at API boot and is deliberately not a barrel side effect, so anything running outside the API —
// a plugin's own test suite, a script — has to call it too. Without this export the only way to do
// that was importing `@fromcode119/core` directly, which the SDK boundary forbids for plugins.
export { ServerCoreServices } from '@fromcode119/core';

// The platform's per-install HMAC signing key, framework-owned. Plugins that mint capability links
// (booking manage tokens, unsubscribe links) MUST derive their key from this and never carry a
// literal fallback — see SigningSecretService.
export { SigningSecretService } from '@fromcode119/core';

export { PluginRegistry } from '@fromcode119/plugins';
export { MediaImageOptimizer } from '@fromcode119/media';
export type { IMediaImageOptimizationOptions, IMediaImageOptimizationResult } from '@fromcode119/media';
