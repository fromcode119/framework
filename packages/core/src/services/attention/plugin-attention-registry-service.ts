import type { IAttentionProviderRegistration } from '@core/services/attention/interfaces/attention-provider-registration.interface';

/**
 * Registry of "needs you" providers.
 *
 * The framework must not know what an order or a form submission is — that is the domain-agnostic
 * rule, and a dashboard that hardcoded `fcp_ecommerce_orders` would break it on the first install
 * without commerce. Plugins register what THEY consider unfinished; core only collects.
 *
 * Registration is idempotent per canonical key, so a plugin re-init replaces rather than stacks.
 */
export class PluginAttentionRegistryService {
  private readonly providers = new Map<string, IAttentionProviderRegistration & { canonicalKey: string }>();

  register(registration: IAttentionProviderRegistration): void {
    const namespace = String(registration?.namespace || '').trim();
    const pluginSlug = String(registration?.pluginSlug || '').trim();
    const key = String(registration?.key || '').trim();
    if (!namespace || !pluginSlug || !key || typeof registration?.resolve !== 'function') return;

    const canonicalKey = `${namespace}:${pluginSlug}:${key}`;
    this.providers.set(canonicalKey, { ...registration, namespace, pluginSlug, key, canonicalKey });
  }

  unregister(canonicalKey: string): void {
    this.providers.delete(canonicalKey);
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    const ns = String(namespace || '').trim();
    const slug = String(pluginSlug || '').trim();
    for (const [canonicalKey, entry] of this.providers.entries()) {
      if (entry.namespace === ns && entry.pluginSlug === slug) this.providers.delete(canonicalKey);
    }
  }

  list(): Array<IAttentionProviderRegistration & { canonicalKey: string }> {
    return Array.from(this.providers.values());
  }

  clear(): void {
    this.providers.clear();
  }
}
