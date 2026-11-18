import type { ICapabilityProvider } from '@core/plugin/capabilities/interfaces/capability-provider.interface';

/**
 * Who provides each capability, so a consumer asks for WHAT it needs — `payment.method`,
 * `tax.calculator`, `shipping.quote` — instead of naming WHO provides it. This is what lets the shop
 * stop reaching for `plugins.optional('org.fromcode:finance')`: it asks the registry for the capability
 * and calls whoever answered, through `context.plugins`, so a second or a replacement provider needs no
 * change in the consumer. More than one plugin may provide the same capability (three payment methods);
 * none can register as another plugin, because the slug is stamped by the framework, not the caller.
 */
export class CapabilityProviderRegistry {
  /** capability → (slug\u0000id → provider). */
  private static readonly byCapability = new Map<string, Map<string, ICapabilityProvider>>();

  private static keyOf(provider: ICapabilityProvider): string {
    return `${provider.slug}\u0000${provider.id ?? ''}`;
  }

  static provide(provider: ICapabilityProvider): void {
    if (!provider?.capability || !provider.slug) return;
    // Clamp the self-declared priority to a bounded integer so no plugin can use an absurd value to
    // force itself to the top, and FREEZE the stored record: a consumer gets copies, never a handle on
    // the shared registry's objects.
    const priority = Math.max(0, Math.min(100, Math.trunc(Number(provider.priority)) || 0));
    const stored = Object.freeze({ ...provider, priority });
    const providers = CapabilityProviderRegistry.byCapability.get(provider.capability) ?? new Map<string, ICapabilityProvider>();
    providers.set(CapabilityProviderRegistry.keyOf(provider), stored);
    CapabilityProviderRegistry.byCapability.set(provider.capability, providers);
  }

  /** Everyone who provides a capability, highest priority first (registration order within a priority).
   * Returns fresh copies, so a consumer can never mutate the shared registry. */
  static providersOf(capability: string): ICapabilityProvider[] {
    const providers = [...(CapabilityProviderRegistry.byCapability.get(capability)?.values() ?? [])];
    return providers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map((provider) => ({ ...provider }));
  }

  /** The preferred provider of a capability, or null when nobody offers it (an empty answer, not a crash). */
  static oneOf(capability: string): ICapabilityProvider | null {
    return CapabilityProviderRegistry.providersOf(capability)[0] ?? null;
  }

  /** Remove every capability a plugin provided — called when it is disabled, so a dead plugin never answers. */
  static withdraw(slug: string): void {
    for (const [capability, providers] of CapabilityProviderRegistry.byCapability) {
      // The slug is the first segment of the map key — the value the framework stamped, not a field a
      // frozen record could have been built to lie about.
      for (const key of [...providers.keys()]) {
        if (key.split('\u0000')[0] === slug) providers.delete(key);
      }
      if (!providers.size) CapabilityProviderRegistry.byCapability.delete(capability);
    }
  }

  /** For tests. */
  static reset(): void {
    CapabilityProviderRegistry.byCapability.clear();
  }
}
