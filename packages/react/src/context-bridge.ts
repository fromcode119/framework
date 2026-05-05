import { ApiPathUtils, ApiScopeClient } from '@fromcode119/core/client';
import type { RuntimeBridgeInstallArgs } from './context-runtime-bridge.interfaces';

export class ContextBridge {
  private static _args: RuntimeBridgeInstallArgs | null = null;

  /**
   * Called once from ContextRuntimeBridge.installRuntimeBridge() to wire up the
   * live args object.  All static methods below delegate directly to _args —
   * no plain-object lookup required.
   */
  static install(args: RuntimeBridgeInstallArgs): void {
    ContextBridge._args = args;
  }

  static registerContentTransformer(...args: any[]): any {
    return ContextBridge._args?.registerContentTransformer?.(...args);
  }

  static registerSlotComponent(...args: any[]): any {
    return ContextBridge._args?.registerSlotComponent?.(...args);
  }

  static registerFieldComponent(...args: any[]): any {
    return ContextBridge._args?.registerFieldComponent?.(...args);
  }

  static registerOverride(...args: any[]): any {
    return ContextBridge._args?.registerOverride?.(...args);
  }

  static registerMenuItem(...args: any[]): any {
    return ContextBridge._args?.registerMenuItem?.(...args);
  }

  static registerCollection(...args: any[]): any {
    return ContextBridge._args?.registerCollection?.(...args);
  }

  static registerPlugins(...args: any[]): any {
    return ContextBridge._args?.registerPlugins?.(...args);
  }

  static registerTheme(...args: any[]): any {
    return ContextBridge._args?.registerTheme?.(...args);
  }

  static registerSettings(...args: any[]): any {
    return ContextBridge._args?.registerSettings?.(...args);
  }

  static registerPluginApi(...args: any[]): any {
    return ContextBridge._args?.registerPluginApi?.(...args);
  }

  static registerPluginScopeApi(namespace: string, name: string): ApiScopeClient {
    const client = new ApiScopeClient(ContextBridge.api, ApiPathUtils.pluginPath(name));
    ContextBridge.registerPluginApi(namespace, name, client);
    return client;
  }

  static registerPluginClient<T>(
    namespace: string,
    name: string,
    factory: (api: any, basePath: string) => T,
  ): T {
    const client = factory(ContextBridge.api, ApiPathUtils.pluginPath(name));
    ContextBridge.registerPluginApi(namespace, name, client);
    return client;
  }

  static getPluginApi(...args: any[]): any {
    return ContextBridge._args?.getPluginApi?.(...args);
  }

  static hasPluginApi(...args: any[]): any {
    return ContextBridge._args?.hasPluginApi?.(...args);
  }

  static setPluginState(...args: any[]): any {
    return ContextBridge._args?.setPluginState?.(...args);
  }

  static loadConfig(...args: any[]): any {
    return ContextBridge._args?.stableLoadConfig?.(...args);
  }

  static getFrontendMetadata(...args: any[]): any {
    return ContextBridge._args?.stableGetFrontendMetadata?.(...args);
  }

  static emit(...args: any[]): any {
    return ContextBridge._args?.emit?.(...args);
  }

  static on(...args: any[]): any {
    return ContextBridge._args?.on?.(...args);
  }

  static t(...args: any[]): any {
    return ContextBridge._args?.stableT?.(...args);
  }

  static locale(): string | undefined {
    return ContextBridge._args?.stabilityRef?.current?.locale;
  }

  static setLocale(...args: any[]): any {
    return ContextBridge._args?.setLocale?.(...args);
  }

  static readonly api = new Proxy(
    {},
    {
      get: (_, prop) => {
        return ContextBridge._args?.stableApiBridge?.[prop as any];
      },
    },
  ) as any;
}
