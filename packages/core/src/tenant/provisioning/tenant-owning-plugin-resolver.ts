import { NamingStrategy, PhysicalTableNameUtils } from '@fromcode119/database';

/**
 * Recovers the plugin slug from a physical table name (`fcp_<slug>_<table>`) by longest-prefix
 * match against a caller-supplied list of REAL plugin slugs — never
 * `PhysicalTableNameUtils.parse`'s naive first-underscore split, which truncates a multi-token
 * slug (`alpha-beta`) down to its first token (`alpha`) and so answers a plugin that may not even
 * be the one that owns the table.
 *
 * The physical name is built from `NamingStrategy.toSnakeIdentifier(pluginSlug)`
 * (`PhysicalTableNameUtils.create`), so a real slug is compared here in its SNAKE form too —
 * comparing the raw slug never matches a hyphenated slug at all. The slug returned is always the
 * caller's original (non-snake) spelling.
 *
 * Longest match wins so a slug that is itself a prefix of another real slug never shadows it:
 * given both `alpha` and `alpha-beta`, `fcp_alpha_beta_widgets` resolves to `alpha-beta`.
 *
 * `null` when nothing in the list matches — the honest answer when the caller has real plugin
 * slugs to check against but none of them own this table; never a guess.
 */
export class TenantOwningPluginResolver {
  static resolve(physicalName: string, knownSlugs: Iterable<string>): string | null {
    const rawValue = String(physicalName || '').trim();
    if (!PhysicalTableNameUtils.hasPlatformPrefix(rawValue)) return null;
    const withoutPrefix = rawValue.slice(PhysicalTableNameUtils.PLATFORM_PREFIX.length);
    let best: { slug: string; snake: string } | null = null;
    for (const slug of knownSlugs) {
      if (!slug) continue;
      const snake = NamingStrategy.toSnakeIdentifier(slug);
      if (!snake || !withoutPrefix.startsWith(`${snake}_`)) continue;
      if (!best || snake.length > best.snake.length) best = { slug, snake };
    }
    return best?.slug ?? null;
  }
}
