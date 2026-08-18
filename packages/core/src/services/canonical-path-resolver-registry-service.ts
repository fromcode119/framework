import type { ICanonicalPathResolver } from '@core/services/interfaces/canonical-path-resolver.interface';

/**
 * Generic registry of canonical-path resolvers.
 *
 * A plugin registers, under its OWN slug, a resolver that reports the single path a document it owns is
 * served at. The routing layer then redirects any other path that resolved to that same document onto
 * the canonical one — so a product reachable at both `/shop/lyubov` and `/cosmic-box/lyubov` answers on
 * exactly one of them instead of publishing itself twice.
 *
 * Unlike {@link RedirectResolverRegistryService}, resolution is keyed rather than first-match: only the
 * resolver registered by the plugin that actually resolved the document runs. One plugin can therefore
 * never declare where ANOTHER plugin's content lives, which a first-match sweep would have allowed.
 *
 * The framework holds no knowledge of which field carries the path (`canonicalUrl`, `customPermalink`, a
 * computed prefix + slug, …) — that is the owning plugin's business, and reading a plugin's column name
 * from here would be exactly the coupling this registry exists to avoid.
 *
 * Registration is idempotent per key, so a plugin re-init never stacks duplicates. A resolver that throws
 * is treated as "no canonical path": a misbehaving plugin must never redirect a visitor somewhere
 * arbitrary, and must never break page resolution for everyone.
 */
export class CanonicalPathResolverRegistryService {
  private readonly resolvers = new Map<string, ICanonicalPathResolver>();

  register(key: string, resolver: ICanonicalPathResolver): void {
    if (!key) throw new Error('CanonicalPathResolverRegistryService.register: a non-empty key is required.');
    this.resolvers.set(key, resolver);
  }

  unregister(key: string): void {
    this.resolvers.delete(key);
  }

  clear(): void {
    this.resolvers.clear();
  }

  has(key: string): boolean {
    return this.resolvers.has(key);
  }

  /**
   * The canonical path the plugin under `key` declares for `doc`, or `null`.
   *
   * Only root-relative paths are returned. A resolver that hands back an absolute URL, a
   * protocol-relative `//host` path, or anything else that could leave the site is discarded — the
   * caller turns this value into a redirect, so an off-site value here would be an open redirect.
   */
  async resolve(key: string, doc: Record<string, unknown> | null, type: string): Promise<string | null> {
    if (!key || !doc) return null;
    const resolver = this.resolvers.get(key);
    if (!resolver) return null;
    try {
      const result = await resolver(doc, type);
      return CanonicalPathResolverRegistryService.normalizeSitePath(result);
    } catch {
      // A failing resolver means "no canonical path" — never a guessed destination.
      return null;
    }
  }

  /**
   * `/a/b` for anything that is unambiguously a root-relative site path, `null` otherwise.
   *
   * Rejecting `//evil.host` matters as much as rejecting `https://evil.host`: browsers read a
   * protocol-relative path as another ORIGIN, so letting one through would hand a redirect to whoever
   * can write that field.
   */
  private static normalizeSitePath(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
    if (raw.includes('\\')) return null;
    const [pathOnly] = raw.split('#');
    const withoutQuery = pathOnly.split('?')[0];
    const trimmed = withoutQuery.replace(/\/+$/, '');
    return trimmed || '/';
  }
}
