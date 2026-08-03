import type { IRedirectResolver } from '@core/services/interfaces/redirect-resolver.interface';
import type { RedirectResolution } from '@core/services/redirect-resolution';

/**
 * Generic registry of redirect resolvers.
 *
 * Plugins register a resolver (keyed by a stable id, e.g. their slug) that, given a request path which
 * resolved to NO content, may return a redirect target. The framework stays plugin-agnostic: it only
 * runs the registered resolvers in registration order and returns the FIRST match — it holds no knowledge
 * of where the rules live (an SEO plugin, a CMS table, …).
 *
 * Registration is idempotent per key: re-registering the same key replaces the previous resolver, so a
 * plugin re-init never stacks duplicates. A resolver that throws is skipped so one misbehaving plugin can
 * never break page resolution for everyone.
 */
export class RedirectResolverRegistryService {
  private readonly resolvers = new Map<string, IRedirectResolver>();

  register(key: string, resolver: IRedirectResolver): void {
    if (!key) throw new Error('RedirectResolverRegistryService.register: a non-empty key is required.');
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

  async resolve(path: string): Promise<RedirectResolution | null> {
    for (const resolver of this.resolvers.values()) {
      try {
        const result = await resolver(path);
        if (result && result.target) {
          return { target: String(result.target), permanent: Boolean(result.permanent) };
        }
      } catch {
        // A failing resolver must never break resolution — try the next one.
      }
    }
    return null;
  }
}
