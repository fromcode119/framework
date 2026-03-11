/**
 * Collection key normalization and slug resolution utilities.
 */
export class CollectionKeyUtils {
  /**
   * Normalises a collection key to a canonical lowercase-hyphenated form.
   * Used for fuzzy slug matching in relationship and tag field components.
   *
   * @example
   * CollectionKeyUtils.normalizeKey('ecommerce_products') // => 'ecommerce-products'
   * CollectionKeyUtils.normalizeKey('  My Collection  ')  // => 'my-collection'
   */
  static normalizeKey(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
  }

  /**
   * Resolves an ambiguous collection slug reference to the actual registered slug.
   * Tries direct match first, then fuzzy-normalised matching with prefix variants.
   * This handles legacy fcp_ prefixed slugs and plugin-slug/collection combinations.
   *
   * @param rawSourceSlug - The slug as supplied by the field definition (may be prefixed/underscored)
   * @param collections   - Live collection registry from ContextHooks.usePlugins()
   * @returns Resolved slug or rawSourceSlug if no match found
   */
  static resolveSourceSlug(rawSourceSlug: string, collections: any[]): string {
    const raw = String(rawSourceSlug || '').trim();
    if (!raw) return '';

    const candidates = new Set<string>();
    const push = (value: unknown) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      candidates.add(trimmed);
      candidates.add(trimmed.replace(/_/g, '-'));
      candidates.add(trimmed.replace(/-/g, '_'));
    };

    push(raw);
    if (raw.startsWith('fcp_')) {
      const withoutPrefix = raw.slice(4);
      push(withoutPrefix);
    } else {
      push(`fcp_${raw.replace(/-/g, '_')}`);
    }

    const direct = collections.find((collection: any) =>
      candidates.has(String(collection?.slug || '').trim())
    );
    if (direct?.slug) return String(direct.slug);

    const normalizedCandidates = new Set(Array.from(candidates).map((entry) => CollectionKeyUtils.normalizeKey(entry)));
    for (const collection of collections || []) {
      const slug = String(collection?.slug || '').trim();
      const shortSlug = String(collection?.shortSlug || '').trim();
      const pluginSlug = String(collection?.pluginSlug || '').trim();
      const combined = pluginSlug && shortSlug ? `${pluginSlug}-${shortSlug}` : '';

      const probes = [slug, shortSlug, combined].map((entry) => CollectionKeyUtils.normalizeKey(entry)).filter(Boolean);
      if (probes.some((probe) => normalizedCandidates.has(probe))) {
        return slug || raw;
      }
    }

    return raw;
  }
}