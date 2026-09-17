import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { RoutingPageUtils } from '@/app/settings/routing/routing-page-utils';
import { RoutingHomeOptions } from '@/app/settings/routing/routing-home-options';
import { RoutingPageState } from '@/app/settings/routing/page-state.client';

/**
 * Working out what the home page ACTUALLY resolves to today, and what it could resolve to.
 *
 * Both answers are derived, never assumed: the options come from the collections this site really
 * has, and the automatic source is detected by asking, so the screen can say which record is being
 * served rather than implying one. Each is keyed and debounced — the inputs change together while an
 * operator types, and an answer for superseded inputs is dropped rather than painted over the
 * current one.
 */
export abstract class RoutingPageResolution extends RoutingPageState {
  /** Debounced rebuild of the homepage target options (replaces the `[deps]` effect + `setTimeout` cleanup). */
  protected scheduleHomeOptions(): void {
    const deps = {
      frontendMeta: this.frontendMeta,
      availableCollections: this.availableCollections,
      collections: this.safeCollections,
      searchTerm: this.searchTerm
    };
    const prev = this.optionsDeps;
    if (
      prev &&
      prev.frontendMeta === deps.frontendMeta &&
      prev.availableCollections === deps.availableCollections &&
      prev.collections === deps.collections &&
      prev.searchTerm === deps.searchTerm
    ) return;
    this.optionsDeps = deps;

    if (this.optionsTimeout) clearTimeout(this.optionsTimeout);
    this.optionsTimeout = null;
    if (!this.frontendMeta) return;

    const requestId = ++this.optionsRequestId;
    this.optionsTimeout = setTimeout(() => { void this.buildHomeOptions(requestId); }, 250);
  }

  protected async buildHomeOptions(requestId: number): Promise<void> {
    const sortedOptions = await RoutingHomeOptions.build({
      searchTerm: this.searchTerm,
      frontendMeta: this.frontendMeta,
      availableCollections: this.availableCollections || [],
      collections: this.safeCollections,
    });
    // The guard stays with the page: a slower earlier build must not overwrite a newer list.
    if (requestId === this.optionsRequestId) {
      this.homeOptions = sortedOptions;
    }
  }

  protected syncAutoSource(): void {
    const deps = {
      availableCollections: this.availableCollections,
      collections: this.safeCollections,
      homeTarget: this.homeTarget
    };
    const prev = this.autoDeps;
    if (
      prev &&
      prev.availableCollections === deps.availableCollections &&
      prev.collections === deps.collections &&
      prev.homeTarget === deps.homeTarget
    ) return;
    this.autoDeps = deps;
    void this.detectAutoSource(++this.autoRequestId);
  }

  protected async detectAutoSource(requestId: number): Promise<void> {
    if (this.homeTarget !== 'auto') {
      this.autoResolvedSource = null;
      return;
    }
    const availableCollectionSet = new Set(
      (this.availableCollections || [])
        .flatMap((c: any) => [String(c?.shortSlug || ''), String(c?.slug || '')])
        .filter(Boolean)
    );
    const candidateCollections = (this.safeCollections || [])
      .filter((c: any) => {
        if (!c || c.system) return false;
        if (availableCollectionSet.size > 0) {
          const shortSlug = String(c.shortSlug || c.slug || '');
          const fullSlug = String(c.slug || '');
          if (!availableCollectionSet.has(shortSlug) && !availableCollectionSet.has(fullSlug)) return false;
        } else {
          // Skip probing collections when admin stats endpoint is unavailable.
          return false;
        }
        return RoutingPageUtils.getFieldNames(c).has('slug');
      })
      .map((c: any) => ({
        collectionSlug: c.shortSlug || c.slug,
        collectionLabel: c.label || c.name || c.shortSlug || c.slug,
        priority: RoutingPageUtils.getAutoCollectionPriority(c)
      }))
      .sort((a: any, b: any) => a.priority - b.priority || a.collectionSlug.localeCompare(b.collectionSlug));

    const queries = [
      { label: '"/"', query: 'customPermalink=%2F' },
      { label: '"/"', query: 'path=%2F' },
      { label: '"home"', query: 'slug=home' },
    ];

    for (const { label, query } of queries) {
      for (const candidate of candidateCollections) {
        try {
          const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(candidate.collectionSlug)}?${query}&limit=1`);
          const doc = Array.isArray(result) ? result[0] : result?.docs?.[0];
          if (doc) {
            const title = RoutingPageUtils.getRecordDisplayTitle(doc, candidate.collectionLabel);
            if (requestId === this.autoRequestId) {
              this.autoResolvedSource = `Matched ${label} -> ${title} (${candidate.collectionLabel})`;
            }
            return;
          }
        } catch {
          // Candidate collection unavailable or no access; continue.
        }
      }
    }
    if (requestId === this.autoRequestId) {
      this.autoResolvedSource = 'No content match for "/" or "home" (using theme fallback).';
    }
  }
}
