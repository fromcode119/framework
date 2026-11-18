/** One plugin's offer to provide a capability (e.g. a `payment.method` called `mypos`). */
export interface ICapabilityProvider {
  /** The capability this provides, e.g. `payment.method`, `tax.calculator`, `shipping.quote`. */
  capability: string;
  /** The providing plugin's slug — set by the framework from the caller, never by the caller. */
  slug: string;
  /** The providing plugin's vendor namespace, so a consumer can call it through `context.plugins`. */
  namespace?: string;
  /** A stable id for THIS provider of the capability (e.g. `mypos`), when a plugin offers several. */
  id?: string;
  /** A human label for the console and for a chooser. */
  label?: string;
  /** Higher wins when a consumer wants one; equal priorities keep registration order. */
  priority?: number;
}

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
    const providers = CapabilityProviderRegistry.byCapability.get(provider.capability) ?? new Map<string, ICapabilityProvider>();
    providers.set(CapabilityProviderRegistry.keyOf(provider), provider);
    CapabilityProviderRegistry.byCapability.set(provider.capability, providers);
  }

  /** Everyone who provides a capability, highest priority first (registration order within a priority). */
  static providersOf(capability: string): ICapabilityProvider[] {
    const providers = [...(CapabilityProviderRegistry.byCapability.get(capability)?.values() ?? [])];
    return providers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /** The preferred provider of a capability, or null when nobody offers it (an empty answer, not a crash). */
  static oneOf(capability: string): ICapabilityProvider | null {
    return CapabilityProviderRegistry.providersOf(capability)[0] ?? null;
  }

  /** Remove every capability a plugin provided — called when it is disabled, so a dead plugin never answers. */
  static withdraw(slug: string): void {
    for (const [capability, providers] of CapabilityProviderRegistry.byCapability) {
      for (const [key, provider] of providers) {
        if (provider.slug === slug) providers.delete(key);
      }
      if (!providers.size) CapabilityProviderRegistry.byCapability.delete(capability);
    }
  }

  /** For tests. */
  static reset(): void {
    CapabilityProviderRegistry.byCapability.clear();
  }
}
