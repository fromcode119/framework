import { PhysicalTableNameUtils } from '@fromcode119/database';

/**
 * Recovers the plugin slug from a physical table name (`fcp_<slug>_<table>`) by longest-prefix
 * match against a caller-supplied list of REAL plugin slugs — never
 * `PhysicalTableNameUtils.parse`'s naive first-underscore split, which truncates a multi-token
 * slug (`logistics_econt`) down to its first token (`logistics`) and so answers a plugin that may
 * not even be the one that owns the table.
 *
 * Longest match wins so a slug that is itself a prefix of another real slug never shadows it:
 * given both `alpha` and `alpha_beta`, `fcp_alpha_beta_widgets` resolves to `alpha_beta`.
 *
 * `null` when nothing in the list matches — the honest answer when the caller has real plugin
 * slugs to check against but none of them own this table; never a guess.
 */
export class TenantOwningPluginResolver {
  static resolve(physicalName: string, knownSlugs: Iterable<string>): string | null {
    const rawValue = String(physicalName || '').trim();
    if (!PhysicalTableNameUtils.hasPlatformPrefix(rawValue)) return null;
    const withoutPrefix = rawValue.slice(PhysicalTableNameUtils.PLATFORM_PREFIX.length);
    let best: string | null = null;
    for (const slug of knownSlugs) {
      if (!slug || !withoutPrefix.startsWith(`${slug}_`)) continue;
      if (!best || slug.length > best.length) best = slug;
    }
    return best;
  }
}
