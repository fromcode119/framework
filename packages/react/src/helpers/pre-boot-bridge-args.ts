import type { IPreBootBridgeInputs } from '@react/interfaces/pre-boot-bridge-inputs.interface';
import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';
import type { PluginsProviderSeed } from '@react/context/plugins-provider-seed';
import { RuntimeBridgeStaticRefs } from '@react/context/runtime-bridge-static-refs';
import { PreBootApiBridge } from '@react/helpers/pre-boot-api-bridge';
import { PreBootBridgeState } from '@react/helpers/pre-boot-bridge-state';
import { PreBootRegistrationSeed } from '@react/context/pre-boot-registration-seed';

/**
 * The install args of the PRE-BOOT bridge: the full static half plus a stand-in for every provider
 * closure.
 *
 * Registrations are routed to the pre-boot queue (`window._fromcodeQueue`, the same queue the stub bridge
 * has always written), which `PreBootRegistrationSeed` folds into the provider's initial state and the
 * live install flushes for the rest. Plugin-API clients and event subscriptions go straight into the
 * store and map the provider will be seeded with, so nothing registered at evaluation waits for a flush.
 *
 * Reads (`stableT`, `stableGetFrontendMetadata`, `stabilityRef.current`) answer from a
 * `PreBootBridgeState`: the inlined config and translations at install, and — once the runtime has folded
 * the queue — the very seed the provider mounts with (`adopt`). Because the live provider publishes its
 * own snapshot from an effect, this state is what every bridge-level read sees DURING the hydrating
 * render, so it must be the seeded state and never a stand-in. The bridge OBJECT forwards these reads
 * through `ContextBridge` at call time, so a binding a bundle took against this install follows the live
 * provider once it mounts.
 */
export class PreBootBridgeArgs {
  static build(inputs: IPreBootBridgeInputs): IRuntimeBridgeInstallArgs {
    const { apiUrl, frontendConfig, locale, translations, pluginApiStore, events, PluginsProvider, runtimeModules } = inputs;
    const queue = PreBootBridgeArgs.queueMethod;
    const noop = () => undefined;
    const stabilityRef = { current: PreBootBridgeState.fromConfig({ apiUrl, frontendConfig, locale, translations }) };

    return {
      ...RuntimeBridgeStaticRefs.build(),
      apiUrl,
      registerContentTransformer: queue('contentTransformer'),
      registerSlotComponent: queue('slot'),
      registerFieldComponent: queue('field'),
      registerOverride: queue('override'),
      registerMenuItem: queue('menuItem'),
      replaceMenuItems: queue('replaceMenuItems'),
      registerCollection: queue('collection'),
      replaceCollections: queue('replaceCollections'),
      registerPlugins: queue('plugins'),
      registerTheme: queue('theme'),
      registerSettings: queue('settings'),
      registerTranslations: queue('translations'),
      setPluginState: queue('pluginState'),
      registerPluginApi: (namespace: string, slug: string, api: unknown) => pluginApiStore.register(namespace, slug, api),
      getPluginApi: (namespace: string, slug: string) => pluginApiStore.get(namespace, slug),
      hasPluginApi: (namespace: string, slug: string) => pluginApiStore.has(namespace, slug),
      emit: (event: string, data: unknown) => { events.get(event)?.forEach((handler) => handler(data)); },
      on: (event: string, handler: (data: any) => void) => {
        if (!events.has(event)) events.set(event, new Set());
        events.get(event)!.add(handler);
        return () => { events.get(event)?.delete(handler); };
      },
      stableLoadConfig: async () => undefined,
      stableGetFrontendMetadata: async () => stabilityRef.current.frontendMetadata,
      stableT: (key: string, params?: Record<string, unknown>, defaultValue?: string) => stabilityRef.current.t(key, params, defaultValue),
      stableApiBridge: PreBootApiBridge.create(),
      setLocale: noop,
      isReady: true,
      PluginsProvider,
      runtimeModules,
      stabilityRef,
    };
  }

  /**
   * Stage two: the runtime has folded the queue into the seed the provider is about to mount with —
   * from here until the live install, the bridge answers from that seed. `args` is the object
   * `ContextBridge.install` holds, so replacing `stabilityRef.current` is all it takes.
   */
  static adopt(args: IRuntimeBridgeInstallArgs, seed: PluginsProviderSeed): void {
    args.stabilityRef.current = PreBootBridgeState.fromSeed(seed, String(args.apiUrl || ''));
  }

  /** The queueing stand-in: the SAME queue shape `setupGlobalStubs` has always written. */
  private static queueMethod(type: string): (...args: any[]) => void {
    return (...args: any[]) => {
      const target = window as unknown as Record<string, any>;
      (target[PreBootRegistrationSeed.QUEUE_KEY] ||= []).push({ type, args });
    };
  }
}
