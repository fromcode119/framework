import { ApiPathUtils, ApiScopeClient } from '@fromcode119/core/client';
import { Platform } from '@fromcode119/react-class-components';
import { PreBootRegistrationSeed } from '@react/context/pre-boot-registration-seed';
import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';

export class ContextBridge {
  private static _args: IRuntimeBridgeInstallArgs | null = null;

  /**
   * Called once from ContextRuntimeBridge.installRuntimeBridge() to wire up the
   * live args object.  All static methods below delegate directly to _args —
   * no plain-object lookup required.
   */
  static install(args: IRuntimeBridgeInstallArgs): void {
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

  static replaceMenuItems(...args: any[]): any {
    return ContextBridge._args?.replaceMenuItems?.(...args);
  }

  static replaceCollections(...args: any[]): any {
    return ContextBridge._args?.replaceCollections?.(...args);
  }

  static registerTheme(...args: any[]): any {
    return ContextBridge._args?.registerTheme?.(...args);
  }

  static registerSettings(...args: any[]): any {
    return ContextBridge._args?.registerSettings?.(...args);
  }

  /**
   * `registerTranslations(payload)` — plugin copy. `registerTranslations(payload, 'theme')` — the
   * theme's, which is the override layer and wins over every plugin default regardless of which
   * bundle evaluated first. See `FrontendI18nService.resolveEffective`.
   *
   * Before any bridge is installed (a module evaluating ahead of the provider), the registration goes
   * onto the pre-boot queue — the same one the stub bridge writes — which the provider's seed folds in
   * or the live install flushes. It used to be dropped silently, so a caller that registers once at
   * evaluation never reached the provider at all.
   */
  static registerTranslations(...args: any[]): any {
    if (ContextBridge._args) return ContextBridge._args.registerTranslations?.(...args);
    if (!Platform.isBrowser) return undefined;
    const target = window as unknown as Record<string, any>;
    (target[PreBootRegistrationSeed.QUEUE_KEY] ||= []).push({ type: 'translations', args });
    return undefined;
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

  /**
   * The provider's translator. The bridge is installed from an effect, so it is empty during server
   * rendering and the first client render; until then this answers the caller's default text (then the
   * key) instead of `undefined`, which rendered the copy as nothing.
   */
  static t(key: string, params?: Record<string, unknown>, defaultValue?: string): string {
    const translate = ContextBridge._args?.stableT;
    return translate ? translate(key, params, defaultValue) : (defaultValue || key);
  }

  static locale(): string | undefined {
    return ContextBridge._args?.stabilityRef?.current?.locale;
  }

  /** The provider's latest stability snapshot — what the bridge's `getState()` reads at CALL time. */
  static getState(): any {
    return ContextBridge._args?.stabilityRef?.current;
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
