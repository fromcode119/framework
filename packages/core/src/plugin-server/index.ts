/**
 * `@fromcode119/core/plugin-server` — the server-side classes the plugin SDK hands to plugins.
 *
 * A separate entry from the core index on purpose, like `./process` and `./client`. Every plugin runs
 * in its own process, and `@fromcode119/sdk/server` used to re-export these from the core index — so a
 * plugin importing only `BaseController` loaded the whole index, and every module it reaches, into
 * that process. Each line here names the ONE module a class lives in, so a plugin process loads what
 * it uses and nothing else. Keep it that way: never re-export a barrel from this file.
 */
export { BasePluginRouter } from '@core/base/base-plugin-router';
export { BaseRouter } from '@core/base/base-router';
export { BaseController } from '@core/base/base-controller';
export { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
export { EnvConfig } from '@core/config/env';
export { EnvUtils } from '@core/utils/env-utils';
export { PluginHealthResponseBuilder } from '@core/plugin/plugin-health-response-builder';
export { PluginHealthRouteHandler } from '@core/plugin/plugin-health-route-handler';
export { Plugins } from '@core/plugin/plugins';
export { Logger } from '@core/logging';
export { ProjectPaths } from '@core/config/paths';
export { RequestContextUtils } from '@core/context/request-context';
export { MediaPathUtils } from '@core/security/media-path-utils';
export { OutboundUrlSecurityPolicy } from '@core/security/outbound-url-security-policy';
export { NetworkAddressUtils } from '@core/security/network-address-utils';
export { ServerCoreServices } from '@core/services/server-core-services';
export { SigningSecretService } from '@core/security/signing-secret-service';
export { GrantTokenService } from '@core/security/grant-token-service';
export { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
export { SystemRedirectService } from '@core/services/system-redirect-service';

export type { IBasePluginRouterOptions } from '@core/base/interfaces/base-plugin-router-options.interface';
export type { IPluginHealthBuildOptions } from '@core/plugin/interfaces/plugin-health-build-options.interface';
export type { IPluginHealthIdentity } from '@core/plugin/interfaces/plugin-health-identity.interface';
export type { IPluginHealthProbeResult } from '@core/plugin/interfaces/plugin-health-probe-result.interface';
export type { IPluginHealthResponse } from '@core/plugin/interfaces/plugin-health-response.interface';
export type { IPluginHealthRouteHandlerOptions } from '@core/plugin/interfaces/plugin-health-route-handler-options.interface';
export type { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';
export type { IRequestStore } from '@core/context/interfaces/request-store.interface';
export type { IGrantEvaluable } from '@core/security/interfaces/grant-evaluable.interface';
