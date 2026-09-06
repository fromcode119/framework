import { CoreServices } from '@core/services/core-services';
import { Plugins } from '@core/plugins';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuestHandlers } from '@core/plugin/host/plugin-guest-handlers';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';

/**
 * The in-process singletons plugins reach for OUTSIDE the context, re-pointed at the host.
 *
 * `CoreServices.getInstance().defaultPageContracts.register(...)` is written in eleven plugins; in a
 * guest the same call would register into the guest's own copy of the registry — a registry the
 * host never reads — and the plugin's pages would silently never materialise. So, before the plugin
 * module is loaded, the four registries plugins use are replaced on the class by bridges: data
 * registrations go straight to the host; function registrations (resolution gates, canonical-path
 * resolvers) are kept here under an id and forwarded when the host asks. `Plugins.namespace(...)`
 * (the static facade) resolves to remote references the same way `context.plugins` does.
 */
export class PluginGuestCoreBridge {
  /** The host's default-page contracts as last fetched; read synchronously by plugin code. */
  private static contracts: unknown[] = [];

  /** Fetch the host's registry into the mirror. Called at boot and again on `plugins:ready`. */
  static async prime(remote: PluginGuestRemote): Promise<void> {
    const listed = await remote.call('core', [{ name: 'defaultPageContracts' }, { name: 'list', args: [] }]);
    PluginGuestCoreBridge.contracts = Array.isArray(listed) ? listed : [];
  }

  private static primedAtBoot = false;
  private static primedAfterBoot = false;

  /**
   * Fills the mirror at the right moments, without subscribing to anything: at the plugin's first
   * lifecycle call (the host has a context for it by then — any earlier and the host refuses, which
   * once put every isolated plugin in the error state), and again on the first NON-lifecycle
   * invocation (a request, a hook, a public-API call), by which time every plugin has booted and
   * registered its contracts. A `plugins:ready` subscription would have needed the `hooks` capability
   * the plugin may not declare — that broke plugins that never use hooks.
   */
  static async primeFor(kind: string, remote: PluginGuestRemote): Promise<void> {
    if (kind === 'lifecycle') {
      if (PluginGuestCoreBridge.primedAtBoot) return;
      PluginGuestCoreBridge.primedAtBoot = true;
      await PluginGuestCoreBridge.prime(remote);
      return;
    }
    if (PluginGuestCoreBridge.primedAfterBoot) return;
    PluginGuestCoreBridge.primedAfterBoot = true;
    await PluginGuestCoreBridge.prime(remote);
  }

  static install(channel: PluginChannel, remote: PluginGuestRemote, handlers: PluginGuestHandlers): void {
    const registration = (payload: IPluginGuestRegistration) => channel.request('register', payload, 30_000);

    const bridges: Record<string, unknown> = {
      defaultPageContracts: {
        register: (input: unknown) => remote.call('core', [{ name: 'defaultPageContracts' }, { name: 'register', args: PluginGuestRemote.portable([input]) }]),
        unregisterByPlugin: (namespace: string, slug: string) => remote.call('core', [{ name: 'defaultPageContracts' }, { name: 'unregisterByPlugin', args: [namespace, slug] }]),
        // Reads are SYNCHRONOUS in-process (`listByPlugin(...).find(...)`), so the guest answers them
        // from a mirror of the host's registry rather than a promise: primed at boot and refreshed on
        // `plugins:ready`, when every plugin has registered. A missing member here is
        // "is not a function" in the guest — that is how the seo audit page 500'd.
        list: () => [...PluginGuestCoreBridge.contracts],
        listByPlugin: (namespace: string, slug: string) => PluginGuestCoreBridge.contracts.filter(
          (contract: any) => String(contract?.namespace) === String(namespace) && String(contract?.pluginSlug) === String(slug),
        ),
      },
      assistantVocabulary: {
        register: (key: string, role: unknown, terms: readonly string[]) => remote.call('core', [{ name: 'assistantVocabulary' }, { name: 'register', args: PluginGuestRemote.portable([key, role, [...terms]]) }]),
      },
      contentResolutionGates: {
        register: (key: string, gate: (...args: any[]) => unknown) => registration({ kind: 'gate', key, handlerId: handlers.keep('gate', gate) }),
      },
      canonicalPathResolvers: {
        register: (key: string, resolver: (...args: any[]) => unknown) => registration({ kind: 'canonical-path', key, handlerId: handlers.keep('canonical-path', resolver) }),
      },
    };

    for (const [name, bridge] of Object.entries(bridges)) {
      Object.defineProperty(CoreServices.prototype, name, { configurable: true, get: () => bridge });
    }

    Plugins.setResolver({
      has: () => true,
      resolve: (namespace: string, slug: string) => remote.ref('context', [{ name: 'plugins' }, { name: 'get', args: [namespace, slug] }]),
    } as any);
  }
}
