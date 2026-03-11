import { BaseService } from './base-service';

/**
 * Service for collection slug and key normalisation utilities.
 *
 * Centralises the fuzzy slug-matching logic used by relationship
 * and tag field components so it is testable and not duplicated.
 *
 * @example
 * ```typescript
 * const services = AdminServices.getInstance();
 * const key = services.collection.normalizeKey('ecommerce_products'); // 'ecommerce-products'
 * const slug = services.collection.resolveSlug('@ecommerce/products', allCollections);
 * ```
 */
export class CollectionService extends BaseService {
  /**
   * Normalises a collection key to a canonical lowercase-hyphenated form.
   * Replaces underscores with hyphens and trims whitespace.
   */
  normalizeKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/_/g, '-');
  }

  /**
   * Resolves an ambiguous collection slug to the registered slug.
   * Handles legacy fcp_ prefixes and plugin-slug/collection combinations.
   *
   * @param rawSlug     - The slug as supplied (may be prefixed/underscored)
   * @param collections - Live collection registry
   */
  resolveSlug(rawSlug: string, collections: Array<{ slug?: string; shortSlug?: string; pluginSlug?: string }>): string {
    const raw = String(rawSlug ?? '').trim();
    if (!raw) return '';

    const candidates = new Set<string>();
    const push = (value: unknown) => {
      const t = String(value ?? '').trim();
      if (!t) return;
      candidates.add(t);
      candidates.add(t.replace(/_/g, '-'));
      candidates.add(t.replace(/-/g, '_'));
    };

    push(raw);
    if (raw.startsWith('fcp_')) {
      push(raw.slice(4));
    } else {
      push(`fcp_${raw.replace(/-/g, '_')}`);
    }

    const direct = collections.find((c) => candidates.has(String(c?.slug ?? '').trim()));
    if (direct?.slug) return String(direct.slug);

    const normalised = new Set(Array.from(candidates).map((e) => this.normalizeKey(e)));
    for (const collection of collections) {
      const slug = String(collection?.slug ?? '').trim();
      const short = String(collection?.shortSlug ?? '').trim();
      const plugin = String(collection?.pluginSlug ?? '').trim();
      const combined = plugin && short ? `${plugin}-${short}` : '';
      const probes = [slug, short, combined].map((e) => this.normalizeKey(e)).filter(Boolean);
      if (probes.some((p) => normalised.has(p))) return slug || raw;
    }

    return raw;
  }
}