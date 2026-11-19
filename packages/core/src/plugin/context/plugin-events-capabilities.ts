import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { Logger } from '@core/logging';
import { PluginEventDelivery } from '@core/plugin/context/plugin-event-delivery';
import { EventListenerRegistry } from '@core/plugin/events/event-listener-registry';
import { EventContractRegistry } from '@core/plugin/events/event-contract-registry';
import type { IEventContract } from '@core/plugin/events/interfaces/event-contract.interface';
import { EventIdempotency } from '@core/plugin/events/event-idempotency';
import { CapabilityProviderRegistry } from '@core/plugin/capabilities/capability-provider-registry';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';

/**
 * The plugin's event / hook / capability surface: instrumented `hooks`, declared `events`
 * (contracts + idempotent effects) and the capability registry access. Lives apart from the
 * context factory so each stays within one responsibility and the file-size limit.
 */
export class PluginEventsCapabilities {
  static build(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: { hasCapability(key: string): boolean; handleViolation(key: string): void },
    pluginLogger: Logger,
    subscribe: (event: string, handler: any, wrap: (h: any) => any) => void,
    unsubscribe: (event: string, handler: any) => void,
  ) {
    const slug = plugin.manifest.slug;

    // A payload that drifted from its event's declared contract throws in dev and the gate, and is
    // logged in production — caught where it is emitted, not where a listener trips over it. An event
    // with no declared contract is not checked.
    const checkEventContract = (event: string, payload: unknown): void => {
      const violation = EventContractRegistry.validate(event, payload);
      if (!violation) return;
      const message = `Event "${event}" payload does not match its contract: ${violation}`;
      if (EventContractRegistry.strict) throw new Error(message);
      pluginLogger.warn(message);
    };

    const hooks = {
      on: (event: string, handler: any) => {
        subscribe(event, handler, (h) => PluginEventDelivery.forHook(manager, slug, h));
        // Record which handler this plugin registered for this event, so a failed delivery can be
        // retried against exactly this listener (see EventDeliveryLedger.retry).
        EventListenerRegistry.register(event, slug, (handler as any)._wrapped);
      },
      off: (event: string, handler: any) => {
        EventListenerRegistry.unregister(event, slug, (handler as any)._wrapped || handler);
        unsubscribe(event, handler);
      },
      emit: (event: string, payload: any) => {
        if (!security.hasCapability('hooks')) security.handleViolation('hooks');
        checkEventContract(event, payload);
        manager.hooks.emit(event, payload);
      },
      call: (event: string, payload: any) => {
        if (!security.hasCapability('hooks')) security.handleViolation('hooks');
        checkEventContract(event, payload);
        return manager.hooks.call(event, payload);
      },
    };

    // Declared events and idempotent effects. `define` records an event's payload contract (opt-in,
    // validated on every emit/call — strict in dev and the gate, logged in production). `once` runs a
    // side effect at most once per key for this plugin, so a retry or a duplicate callback does its
    // work once (EventIdempotency).
    const events = {
      define: (contract: IEventContract) => {
        if (!security.hasCapability('hooks')) security.handleViolation('hooks');
        // A plugin may declare only its OWN events — those prefixed with its slug — so it cannot
        // hijack another plugin's contract. A site-owned plugin registers nothing in the
        // process-global registry (two sites running a same-slug plugin would otherwise collide).
        if (!contract?.event || !contract.event.startsWith(`${slug}:`)) {
          throw new Error(`Plugin "${slug}" may only define events in its own namespace ("${slug}:…").`);
        }
        if (PluginOwners.ownerOf(slug)) return;
        EventContractRegistry.define({ ...contract, owner: slug });
      },
      once: <T>(key: string, fn: () => Promise<T> | T) => EventIdempotency.once(manager, slug, key, fn),
      forget: (key: string) => EventIdempotency.release(manager, slug, key),
      // The two halves of `once`, for an isolated plugin: its effect runs in another process, so its
      // guest context claims here, runs the effect there, and releases here if the effect threw.
      claim: (key: string) => EventIdempotency.claim(manager, slug, key),
    };

    // Ask for WHAT you need, not WHO provides it. `provide` registers this plugin (its slug is
    // stamped here, so it cannot register as another); `all`/`one` return the providers, which the
    // consumer calls through `context.plugins` — the end of `plugins.optional('org.fromcode:finance')`.
    const capabilities = {
      provide: (capability: string, meta: { id?: string; label?: string; priority?: number } = {}) => {
        if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
        // A site-owned plugin must not register in the process-global registry: its provider would
        // be visible to, and callable by, every other site. Only platform plugins provide globally.
        // (Per-site providers would need a tenant-scoped registry — a larger change for when a site
        // plugin actually needs to offer a capability.)
        if (PluginOwners.ownerOf(slug)) return;
        CapabilityProviderRegistry.provide({
          capability, slug, namespace: plugin.manifest.namespace,
          id: meta.id, label: meta.label, priority: meta.priority,
        });
      },
      all: (capability: string) => CapabilityProviderRegistry.providersOf(capability),
      one: (capability: string) => CapabilityProviderRegistry.oneOf(capability),
    };

    return { hooks, events, capabilities };
  }
}
