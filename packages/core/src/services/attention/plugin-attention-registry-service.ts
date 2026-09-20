import type { IAttentionProviderRegistration } from '@core/services/attention/interfaces/attention-provider-registration.interface';

/**
 * Registry of "needs you" providers.
 *
 * The framework must not know what an order or a form submission is — that is the domain-agnostic
 * rule, and a dashboard that hardcoded `fcp_acme_orders` would break it on the first install
 * without commerce. Plugins register what THEY consider unfinished; core only collects.
 *
 * Registration is idempotent per canonical key, so a plugin re-init replaces rather than stacks.
 */
export class PluginAttentionRegistryService {
  private readonly providers = new Map<string, IAttentionProviderRegistration & { canonicalKey: string }>();

  // Plugins call this across the SDK boundary, so a caller can hand a registration missing
  // `resolve` despite the declared contract — the checks below are real validation, not decoration.
  register(registration: Omit<IAttentionProviderRegistration, 'resolve'> & { resolve?: unknown }): void {
    const namespace = String(registration?.namespace || '').trim();
    const pluginSlug = String(registration?.pluginSlug || '').trim();
    const key = String(registration?.key || '').trim();
    const resolve = registration?.resolve;
    if (!namespace || !pluginSlug || !key || typeof resolve !== 'function') return;

    const canonicalKey = `${namespace}:${pluginSlug}:${key}`;
    this.providers.set(canonicalKey, {
      ...registration, namespace, pluginSlug, key, canonicalKey,
      resolve: resolve as IAttentionProviderRegistration['resolve'],
    });
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
