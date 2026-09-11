import type { ICatalogContributor } from '@core/marketplace/contributions/interfaces/catalog-contributor.interface';

/**
 * Registry of things that can offer installable versions besides the remote marketplace.
 *
 * The framework must not know what a build server is — naming one here would be the same mistake as
 * a dashboard that hardcoded an orders table. It knows only that something registered, and asks it.
 *
 * Registration is idempotent per canonical key, so a plugin re-init replaces rather than stacks.
 */
export class CatalogContributionRegistry {
  private readonly contributors = new Map<string, ICatalogContributor & { canonicalKey: string }>();

  register(contributor: ICatalogContributor): void {
    const namespace = String(contributor?.namespace || '').trim();
    const pluginSlug = String(contributor?.pluginSlug || '').trim();
    if (!namespace || !pluginSlug || typeof contributor?.list !== 'function') return;

    const canonicalKey = `${namespace}:${pluginSlug}`;
    this.contributors.set(canonicalKey, { ...contributor, namespace, pluginSlug, canonicalKey });
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    this.contributors.delete(`${String(namespace || '').trim()}:${String(pluginSlug || '').trim()}`);
  }

  list(): Array<ICatalogContributor & { canonicalKey: string }> {
    return Array.from(this.contributors.values());
  }

  clear(): void {
    this.contributors.clear();
  }
}
