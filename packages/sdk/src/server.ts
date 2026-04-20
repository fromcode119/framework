// Server-only SDK exports — for use in plugin API route files only.
// Never import from this path in React components or client-side code.
// These exports transitively depend on express, fs, path, or server-only @fromcode119/* packages.
export { 
  BasePluginRouter, 
  BaseRouter, 
  BaseController,
  PluginHealthResponseBuilder,
  PluginHealthRouteHandler,
  PluginManager,
  ThemeManager,
  Logger,
  ProjectPaths,
  IntegrationManager,
  RequestContextUtils,
  PluginDefinitionUtils
} from '@fromcode119/core';

export type { 
  BasePluginRouterOptions, 
  PluginHealthBuildOptions, 
  PluginHealthIdentity, 
  PluginHealthProbeResult, 
  PluginHealthResponse, 
  PluginHealthRouteHandlerOptions, 
  PluginHealthStatus,
  RequestStore
} from '@fromcode119/core';

export { PluginRegistry } from '@fromcode119/plugins';
export { MediaImageOptimizer } from '@fromcode119/media';
export type { 
  MediaImageOptimizationOptions, 
  MediaImageOptimizationResult 
} from '@fromcode119/media';
