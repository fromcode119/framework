// Server-only SDK exports — for use in plugin API route files only.
// Never import from this path in React components or client-side code.
// These exports transitively depend on express, fs, path, or server-only @fromcode119/* packages.
//
// Every plugin process imports this file, so it must stay light: the core classes come from
// `@fromcode119/core/plugin-server`, which names one module per class, never from the core index. The
// few exports that live in heavy packages go through `LazyExport` and load on first use — a plugin that
// never touches `APIServer` never loads the api (that one import was about 70 MB in every process).
import type { APIServer as APIServerClass } from '@fromcode119/api';
import type { AuthManager as AuthManagerClass } from '@fromcode119/auth';
import type { PluginManager as PluginManagerClass, ThemeManager as ThemeManagerClass, IntegrationManager as IntegrationManagerClass } from '@fromcode119/core';
import type { PluginRegistry as PluginRegistryClass } from '@fromcode119/plugins';
import type { MediaImageOptimizer as MediaImageOptimizerClass } from '@fromcode119/media';
import { LazyExport } from '@sdk/lazy-export';

export { BasePluginRouter, BaseRouter, BaseController, AccessLevel, EnvConfig, EnvUtils, PluginHealthResponseBuilder, PluginHealthRouteHandler, Plugins, Logger, ProjectPaths, RequestContextUtils, MediaPathUtils, OutboundUrlSecurityPolicy, NetworkAddressUtils } from '@fromcode119/core/plugin-server';

export type { IBasePluginRouterOptions, IPluginHealthBuildOptions, IPluginHealthIdentity, IPluginHealthProbeResult, IPluginHealthResponse, IPluginHealthRouteHandlerOptions, PluginHealthStatus, IRequestStore } from '@fromcode119/core/plugin-server';

/* eslint-disable @typescript-eslint/no-var-requires */
export const APIServer: typeof APIServerClass = LazyExport.of(() => require('@fromcode119/api').APIServer);
export const AuthManager: typeof AuthManagerClass = LazyExport.of(() => require('@fromcode119/auth').AuthManager);
export const PluginManager: typeof PluginManagerClass = LazyExport.of(() => require('@fromcode119/core').PluginManager);
export const ThemeManager: typeof ThemeManagerClass = LazyExport.of(() => require('@fromcode119/core').ThemeManager);
export const IntegrationManager: typeof IntegrationManagerClass = LazyExport.of(() => require('@fromcode119/core').IntegrationManager);
export const PluginRegistry: typeof PluginRegistryClass = LazyExport.of(() => require('@fromcode119/plugins').PluginRegistry);
export const MediaImageOptimizer: typeof MediaImageOptimizerClass = LazyExport.of(() => require('@fromcode119/media').MediaImageOptimizer);
/* eslint-enable @typescript-eslint/no-var-requires */
// The same names as types, so `let registry: PluginRegistry` keeps meaning the class's instances.
export type APIServer = APIServerClass;
export type AuthManager = AuthManagerClass;
export type PluginManager = PluginManagerClass;
export type ThemeManager = ThemeManagerClass;
export type IntegrationManager = IntegrationManagerClass;
export type PluginRegistry = PluginRegistryClass;
export type MediaImageOptimizer = MediaImageOptimizerClass;

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

export type { IMediaImageOptimizationOptions, IMediaImageOptimizationResult } from '@fromcode119/media';
