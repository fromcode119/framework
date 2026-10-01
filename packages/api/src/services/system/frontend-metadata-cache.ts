import { ApiResponseCache, RequestContextUtils, SiteContentRevision } from '@fromcode119/core';
import type { IFrontendMetadataParts } from '@api/services/system/interfaces/frontend-metadata-parts.interface';

/**
 * The site's parts of `/system/frontend`, kept per site.
 *
 * Every storefront render asks for this answer, and an uncached page load recomputed it in full — the
 * admin metadata, the public settings and the plugins' public settings, about two seconds each under a
 * burst of twenty, all for the same site at the same moment. Kept here, a site's parts are computed once
 * per content revision, and requests that arrive while they are being computed share that one
 * computation instead of each starting their own.
 *
 * Nothing per caller is kept: the parts are the site's (see IFrontendMetadataParts), and what depends
 * on who is asking — whether they may preview a closed site — is decided per request outside this cache.
 *
 * A kept entry is used only while all of these hold:
 *  - the site's content revision is the one it was computed under. Every write that can reach a site's
 *    pages moves it — a setting, a plugin's settings, a collection, a plugin's own rows, a cache purge
 *    (SiteContentRevision) — in every api process;
 *  - the site's plugin set and theme are the ones it was computed for (`signature`), as enabling,
 *    disabling or upgrading a plugin, or switching themes, need not write anything that moves it;
 *  - it is younger than the operator's API response cache maximum age (Settings → Infrastructure);
 *    with that setting off, nothing is kept.
 */
export class FrontendMetadataCache {
  private readonly kept = new Map<string, { key: string; at: number; parts: Promise<IFrontendMetadataParts> }>();

  /** The current site's parts, computed by `compute` only when no usable kept entry exists. */
  get(signature: string, compute: () => Promise<IFrontendMetadataParts>): Promise<IFrontendMetadataParts> {
    const maxAgeMs = ApiResponseCache.maxAgeSeconds() * 1000;
    if (maxAgeMs <= 0) return compute();
    const site = String(RequestContextUtils.getTenantId() ?? '');
    const key = `${SiteContentRevision.current(site || null)}|${signature}`;
    const kept = this.kept.get(site);
    if (kept && kept.key === key && Date.now() - kept.at < maxAgeMs) return kept.parts;

    const entry = { key, at: Date.now(), parts: compute() };
    this.kept.set(site, entry);
    // A failed computation is not an answer: forget it, so the next request tries again.
    entry.parts.catch(() => { if (this.kept.get(site) === entry) this.kept.delete(site); });
    return entry.parts;
  }
}
