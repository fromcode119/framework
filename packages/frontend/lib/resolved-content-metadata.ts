import type { IHeadData } from '@/lib/interfaces/head-data.interface';
import { cache } from 'react';

import type { Metadata } from 'next';
import { ServerApiUtils } from '@/lib/server-api';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';

export class ResolvedContentMetadata {
  static build(content: Record<string, unknown> | null, resolutionType?: string): Metadata {
    const title = ResolvedContentMetadata.resolveTitle(content) || undefined;
    const description = ResolvedContentMetadata.resolveDescription(content) || undefined;
    const other = ResolvedContentMetadata.buildOtherMetadata(content, resolutionType);

    return {
      title,
      description,
      other,
    };
  }

  /**
   * Server-side enriched metadata: merges the base (breadcrumb `other` tags) with the
   * head-data provider plugin's resolved head data (manifest `ui.headDataPath`, e.g. the
   * SEO plugin) so the INITIAL server HTML carries a proper
   * title, description, Open Graph, Twitter card, canonical, and robots — not just a title.
   */
  static async buildEnriched(
    content: Record<string, unknown> | null,
    resolutionType: string | undefined,
    url: string,
  ): Promise<Metadata> {
    const base = ResolvedContentMetadata.build(content, resolutionType);
    const head = await ResolvedContentMetadata.fetchHeadData({
      url,
      contentType: ResolvedContentMetadata.resolveContentType(content, resolutionType),
      contentId: ResolvedContentMetadata.resolveContentId(content),
      title: ResolvedContentMetadata.resolveTitle(content),
      description: ResolvedContentMetadata.resolveDescription(content),
      // The resolved record itself: the provider declares which of the record's fields it
      // wants forwarded (manifest `ui.headDataRecordFields`) and the framework forwards them
      // opaquely — it never knows a provider field by name.
      record: content,
    });
    if (!head) return base;

    const canonical = head.canonical || undefined;
    const images = head.ogImage ? [head.ogImage] : undefined;
    const ogTitle = head.ogTitle || head.title || undefined;
    const ogDescription = head.ogDescription || head.description || undefined;

    return {
      ...base,
      title: head.title ? { absolute: head.title } : base.title,
      description: head.description || base.description,
      alternates: canonical ? { canonical } : base.alternates,
      robots: ResolvedContentMetadata.parseRobots(head.robots),
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: canonical,
        siteName: head.siteName || undefined,
        type: 'website',
        images,
      },
      twitter: {
        card: (head.twitterCard as 'summary_large_image' | 'summary') || 'summary_large_image',
        title: ogTitle,
        description: ogDescription,
        images,
        site: head.twitterHandle || undefined,
      },
    };
  }

  /**
   * The site-wide brand defaults every document starts from — the root layout's metadata and the
   * islands document's `site` metadata are this ONE object, so the two heads cannot drift. Brand
   * values come from the head-data provider plugin's settings, never a hardcoded value.
   */
  static async buildSiteMetadata(): Promise<Metadata> {
    const head = await ResolvedContentMetadata.fetchSite();
    const siteName = head?.siteName || head?.title || 'Home';
    const images = head?.ogImage ? [head.ogImage] : undefined;
    return {
      title: { default: siteName, template: `%s | ${siteName}` },
      description: head?.description || undefined,
      openGraph: { siteName, title: siteName, description: head?.description || undefined, type: 'website', images },
      twitter: { card: 'summary_large_image', title: siteName, description: head?.description || undefined, images },
      icons: { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/apple-touch-icon.png' },
    };
  }

  /** Public helper for site-wide brand defaults (used by the root layout). */
  static async fetchSite(): Promise<IHeadData | null> {
    return ResolvedContentMetadata.fetchHeadData({ url: '/', contentType: '', contentId: '', title: '', description: '' });
  }

  /**
   * The page's JSON-LD payloads, for the page COMPONENT to render as ld+json scripts — Next's
   * Metadata API carries no structured data, so the body owns it. Builds the identical head-data
   * query `buildEnriched` builds, so the per-request cache serves both from ONE provider fetch.
   */
  static async buildStructuredData(
    content: Record<string, unknown> | null,
    resolutionType: string | undefined,
    url: string,
  ): Promise<string[]> {
    const head = await ResolvedContentMetadata.fetchHeadData({
      url,
      contentType: ResolvedContentMetadata.resolveContentType(content, resolutionType),
      contentId: ResolvedContentMetadata.resolveContentId(content),
      title: ResolvedContentMetadata.resolveTitle(content),
      description: ResolvedContentMetadata.resolveDescription(content),
      record: content,
    });
    const schema = head?.schema;
    return Array.isArray(schema) ? schema.filter((json) => typeof json === 'string' && json.trim()) : [];
  }

  private static resolveStringField(content: Record<string, unknown> | null, field: string): string {
    const value = content?.[field];
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * Per-request memoized head-data fetch (React `cache()`), keyed by the full
   * query string (a primitive, so layout `fetchSite` and page `buildEnriched` dedupe
   * whenever they build the identical query). Per-request only — no cross-request
   * persistence (storefront-performance-audit.md §1.2 / Phase 1.2).
   */
  private static readonly headDataCache = cache(async (queryString: string): Promise<IHeadData | null> => {
    const provider = await ResolvedContentMetadata.resolveHeadDataProvider();
    if (!provider) return null;
    const path = ServerApiUtils.buildPluginPath(provider.pluginSlug, provider.headDataPath, queryString);
    // Strict: an unreachable API must NOT be read as "the provider has no head data". Doing so
    // publishes canonical/robots tags the operator never configured — a page that should be
    // noindex would quietly get indexed. Throwing turns the request into an honest 5xx instead.
    // The provider is a PLUGIN route. An isolated plugin's process is replaced in place on update or
    // after a crash, and for that moment its route answers 502. That is not the api being down, so it
    // is retried briefly before it is treated as unreachable and this page becomes an honest 5xx.
    let outcome = await ServerApiUtils.serverFetchJsonOutcome(path);
    for (const delayMs of ResolvedContentMetadata.PLUGIN_SWAP_RETRY_DELAYS_MS) {
      if (!outcome.isUnreachable) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      outcome = await ServerApiUtils.serverFetchJsonOutcome(path);
    }
    const data = outcome.valueOrThrow(path) as IHeadData | null;
    return data && typeof data === 'object' && typeof data.title === 'string' ? data : null;
  });

  /** Two short waits cover a plugin process swap (~1 s); an api that is really down still fails fast. */
  private static readonly PLUGIN_SWAP_RETRY_DELAYS_MS = [400, 1200];

  /**
   * Discovers the head-data provider from `/system/frontend` plugin metadata (via the
   * per-request cached FrontendConfigCache — no extra fetch). A plugin opts in by
   * declaring `ui.headDataPath` in its manifest (e.g. the SEO plugin's `"head-data"`);
   * the first declaring plugin in the API's plugin order (`getSortedPlugins`, a
   * deterministic priority sort) wins. No plugin declaring it means head-data is
   * skipped and callers fall back to base metadata.
   */
  private static async resolveHeadDataProvider(): Promise<{ pluginSlug: string; headDataPath: string; recordFields: string[] } | null> {
    // Strict: "no plugin declares headDataPath" and "we could not read the plugin list" are
    // different answers, and only the first justifies skipping head data.
    const config = (await FrontendConfigCache.readOutcome()).valueOrThrow('/system/frontend');
    const plugins = Array.isArray(config?.plugins) ? config?.plugins as Array<Record<string, unknown>> : [];
    for (const plugin of plugins) {
      const pluginSlug = String(plugin?.slug || '').trim();
      const ui = plugin?.ui as Record<string, unknown> | undefined;
      const headDataPath = String(ui?.headDataPath || '').trim().replace(/^\/+/, '');
      if (pluginSlug && headDataPath) {
        return { pluginSlug, headDataPath, recordFields: ResolvedContentMetadata.sanitizeRecordFields(ui?.headDataRecordFields) };
      }
    }
    return null;
  }

  /**
   * The provider's `ui.headDataRecordFields` declaration: which fields of the resolved
   * content record it wants forwarded on the head-data query. The names are the provider's
   * own vocabulary — the framework treats them as opaque strings. Reserved base query keys
   * are dropped so a declaration can never overwrite `url`/`title`/etc.
   */
  private static sanitizeRecordFields(declared: unknown): string[] {
    const reserved = new Set(['url', 'contentType', 'contentId', 'title', 'description']);
    const names = Array.isArray(declared) ? declared : [];
    const fields: string[] = [];
    for (const name of names) {
      const field = String(name || '').trim();
      if (field && !reserved.has(field) && !fields.includes(field)) fields.push(field);
    }
    return fields;
  }

  private static async fetchHeadData(params: {
    url: string;
    contentType: string;
    contentId: string;
    title: string;
    description: string;
    record?: Record<string, unknown> | null;
  }): Promise<IHeadData | null> {
    // Resolved here (and again inside the cache) from the per-request FrontendConfigCache —
    // the declared record-field list must shape the query string before the cache key exists.
    const provider = await ResolvedContentMetadata.resolveHeadDataProvider();
    if (!provider) return null;
    const query = new URLSearchParams();
    query.set('url', params.url || '/');
    if (params.contentType) query.set('contentType', params.contentType);
    if (params.contentId) query.set('contentId', params.contentId);
    if (params.title) query.set('title', params.title);
    if (params.description) query.set('description', params.description);
    for (const field of provider.recordFields) {
      const value = ResolvedContentMetadata.resolveStringField(params.record ?? null, field);
      if (value) query.set(field, value);
    }
    return ResolvedContentMetadata.headDataCache(query.toString());
  }

  private static parseRobots(robots: string): Metadata['robots'] {
    const value = String(robots || '').toLowerCase();
    if (!value || value === 'index,follow') return undefined;
    return { index: !value.includes('noindex'), follow: !value.includes('nofollow') };
  }

  private static buildOtherMetadata(
    content: Record<string, unknown> | null,
    resolutionType?: string,
  ): Record<string, string> | undefined {
    const contentType = ResolvedContentMetadata.resolveContentType(content, resolutionType);
    const contentId = ResolvedContentMetadata.resolveContentId(content);
    const other: Record<string, string> = {};

    if (contentType) {
      other['fromcode:resolved-type'] = contentType;
    }

    if (contentId) {
      other['fromcode:resolved-id'] = contentId;
    }

    return Object.keys(other).length > 0 ? other : undefined;
  }

  private static resolveContentId(content: Record<string, unknown> | null): string {
    const rawId = content?.id;
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      return String(rawId);
    }

    if (typeof rawId === 'string') {
      return rawId.trim();
    }

    return '';
  }

  private static resolveContentType(content: Record<string, unknown> | null, resolutionType?: string): string {
    const rawType = String(resolutionType || content?.contentType || content?.type || '').trim();
    return rawType.toLowerCase();
  }

  private static resolveTitle(content: Record<string, unknown> | null): string {
    return String(
      content?.title ??
      content?.name ??
      '',
    ).trim();
  }

  private static resolveDescription(content: Record<string, unknown> | null): string {
    return String(
      content?.description ??
      content?.excerpt ??
      '',
    ).trim();
  }
}