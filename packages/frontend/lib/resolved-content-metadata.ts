import type { Metadata } from 'next';
import { ServerApiUtils } from './server-api';

interface SeoHeadData {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  siteName: string;
  siteUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  twitterHandle: string;
}

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
   * Server-side enriched metadata: merges the base (breadcrumb `other` tags) with the SEO
   * plugin's resolved head data (`/head-data`) so the INITIAL server HTML carries a proper
   * title, description, Open Graph, Twitter card, canonical, and robots — not just a title.
   */
  static async buildEnriched(
    content: Record<string, unknown> | null,
    resolutionType: string | undefined,
    url: string,
  ): Promise<Metadata> {
    const base = ResolvedContentMetadata.build(content, resolutionType);
    const seo = await ResolvedContentMetadata.fetchSeoHeadData({
      url,
      contentType: ResolvedContentMetadata.resolveContentType(content, resolutionType),
      contentId: ResolvedContentMetadata.resolveContentId(content),
      title: ResolvedContentMetadata.resolveTitle(content),
      description: ResolvedContentMetadata.resolveDescription(content),
    });
    if (!seo) return base;

    const canonical = seo.canonical || undefined;
    const images = seo.ogImage ? [seo.ogImage] : undefined;
    const ogTitle = seo.ogTitle || seo.title || undefined;
    const ogDescription = seo.ogDescription || seo.description || undefined;

    return {
      ...base,
      title: seo.title ? { absolute: seo.title } : base.title,
      description: seo.description || base.description,
      alternates: canonical ? { canonical } : base.alternates,
      robots: ResolvedContentMetadata.parseRobots(seo.robots),
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: canonical,
        siteName: seo.siteName || undefined,
        type: 'website',
        images,
      },
      twitter: {
        card: (seo.twitterCard as 'summary_large_image' | 'summary') || 'summary_large_image',
        title: ogTitle,
        description: ogDescription,
        images,
        site: seo.twitterHandle || undefined,
      },
    };
  }

  /** Public helper for site-wide brand defaults (used by the root layout). */
  static async fetchSite(): Promise<SeoHeadData | null> {
    return ResolvedContentMetadata.fetchSeoHeadData({ url: '/', contentType: '', contentId: '', title: '', description: '' });
  }

  private static async fetchSeoHeadData(params: {
    url: string;
    contentType: string;
    contentId: string;
    title: string;
    description: string;
  }): Promise<SeoHeadData | null> {
    const query = new URLSearchParams();
    query.set('url', params.url || '/');
    if (params.contentType) query.set('contentType', params.contentType);
    if (params.contentId) query.set('contentId', params.contentId);
    if (params.title) query.set('title', params.title);
    if (params.description) query.set('description', params.description);
    const path = ServerApiUtils.buildPluginPath('seo', 'head-data', query);
    const data = (await ServerApiUtils.serverFetchJson(path)) as SeoHeadData | null;
    return data && typeof data === 'object' && typeof data.title === 'string' ? data : null;
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