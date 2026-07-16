import { EnvUtils, type Collection } from '@fromcode119/core';

/**
 * In-process caches for route resolution (`/system/resolve`) — the hottest storefront SSR path.
 *
 * Three caches, each with strict scoping (see the storefront performance audit §1.3/§resolve):
 *
 * 1. **Result LRU** — resolved-slug results keyed on `path|locale|fallback_locale|locale_mode`.
 *    ONLY anonymous (`options.user` absent) non-preview resolutions are cached — content-resolution
 *    gates (paywall/members-only) run with the visitor's identity AFTER `resolveSlugRaw`, so the raw
 *    resolution is identity-free for anonymous visitors and gates still run per request on cache hits.
 *    Values are deep-cloned on write AND read so gates/consumers can never mutate a shared cached doc.
 *    Misses (`null`) are cached too, on a shorter TTL, to absorb 404 storms from URL-probing bots.
 *    TTL is `RESOLVE_CACHE_TTL_MS` (default 30s; `0` disables all result caching). Invalidated on
 *    every collection write hook — content edits are visible immediately when hooks fire, and within
 *    the TTL window otherwise.
 *
 * 2. **Permalink structure** — replaces a full `_system_meta` table scan per resolve call with a
 *    30s-TTL cached value, invalidated by the `system:settings:updated` hook (staleness window is
 *    therefore hook-immediate on this instance, ≤30s across other processes).
 *
 * 3. **Collection capability flags** — `hasCustomPermalink`/`hasSlug` per collection object,
 *    WeakMap-keyed on the collection identity so re-registration (plugin enable/disable rebuilds the
 *    collection objects) naturally invalidates.
 */
export class ResolutionCacheService {
  private static readonly MAX_ENTRIES = 500;
  private static readonly PERMALINK_TTL_MS = 30_000;
  private static readonly NEGATIVE_TTL_MS = 8_000;

  private readonly ttlMs: number;
  private readonly results = new Map<string, { value: any; expiresAt: number }>();
  private permalink: { value: string; expiresAt: number } | null = null;
  private readonly collectionFlags = new WeakMap<object, { hasCustomPermalink: boolean; hasSlug: boolean }>();

  constructor() {
    this.ttlMs = Math.max(0, EnvUtils.number('RESOLVE_CACHE_TTL_MS', 30_000));
  }

  get enabled(): boolean {
    return this.ttlMs > 0;
  }

  get size(): number {
    return this.results.size;
  }

  /** Result caching is allowed ONLY for anonymous, non-preview resolutions. */
  isCacheable(options: { user?: any; preview?: boolean }): boolean {
    return this.enabled && !options.preview && (options.user === null || options.user === undefined);
  }

  buildKey(normalizedInput: string, options: { locale?: string; fallback_locale?: string; locale_mode?: string }): string {
    return [normalizedInput, options.locale || '', options.fallback_locale || '', options.locale_mode || ''].join('|');
  }

  /** Returns `{ value }` on a live hit (value deep-cloned), or `null` when absent/expired. */
  getResult(key: string): { value: any } | null {
    const entry = this.results.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.results.delete(key);
      return null;
    }
    // LRU touch: re-insert so Map iteration order tracks recency.
    this.results.delete(key);
    this.results.set(key, entry);
    if (entry.value === null) return { value: null };
    const cloned = this.clone(entry.value);
    return cloned === undefined ? null : { value: cloned };
  }

  /** Store a resolution result. `null` (a miss) is stored on the shorter negative TTL. */
  setResult(key: string, value: any): void {
    if (!this.enabled) return;
    const isNegative = value === null || value === undefined;
    const stored = isNegative ? null : this.clone(value);
    if (!isNegative && stored === undefined) return; // uncloneable — never share a mutable reference
    if (!this.results.has(key) && this.results.size >= ResolutionCacheService.MAX_ENTRIES) {
      const oldest = this.results.keys().next();
      if (!oldest.done) this.results.delete(oldest.value);
    }
    const ttl = isNegative ? Math.min(this.ttlMs, ResolutionCacheService.NEGATIVE_TTL_MS) : this.ttlMs;
    this.results.set(key, { value: stored, expiresAt: Date.now() + ttl });
  }

  /** Clear cached resolution results (any content write). */
  invalidateResults(): void {
    this.results.clear();
  }

  /** Clear everything (settings changed — permalink structure may have moved). */
  invalidateAll(): void {
    this.results.clear();
    this.permalink = null;
  }

  /** Permalink structure with a short TTL — replaces the per-call `_system_meta` full scan. */
  async getPermalinkStructure(loader: () => Promise<string>): Promise<string> {
    if (this.permalink && this.permalink.expiresAt > Date.now()) return this.permalink.value;
    const value = await loader();
    this.permalink = { value, expiresAt: Date.now() + ResolutionCacheService.PERMALINK_TTL_MS };
    return value;
  }

  /** Per-collection field-capability flags, computed once per collection object. */
  getCollectionFlags(collection: Collection): { hasCustomPermalink: boolean; hasSlug: boolean } {
    const cached = this.collectionFlags.get(collection as unknown as object);
    if (cached) return cached;
    const fields = Array.isArray((collection as any)?.fields) ? (collection as any).fields : [];
    const flags = {
      hasCustomPermalink: fields.some((f: any) => f?.name === 'customPermalink'),
      hasSlug: fields.some((f: any) => f?.name === 'slug'),
    };
    this.collectionFlags.set(collection as unknown as object, flags);
    return flags;
  }

  private clone(value: any): any {
    if (value === null || value === undefined) return value;
    try {
      return structuredClone(value);
    } catch {
      return undefined;
    }
  }
}
