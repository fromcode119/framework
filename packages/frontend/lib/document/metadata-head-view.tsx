import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CoercionUtils } from '@fromcode119/core/client';

/**
 * The `<head>` tags for a `Metadata` object — the same object `ResolvedContentMetadata.buildEnriched`
 * hands to Next's metadata pipeline for the App Router pages, rendered here as plain elements for the
 * islands document. One source of truth for WHAT the head says (the metadata builders); this class only
 * decides how each field becomes a tag, mirroring Next's own output so the head parity diff stays empty.
 *
 * Title resolution follows Next: a page `{ absolute }` wins outright; a page string goes through the
 * site's `{ template }` (`%s | Site`); no page title → the site `{ default }`.
 */
export class MetadataHeadView {
  static render({ page, site }: { page: Metadata; site: Metadata }): ReactNode {
    const title = MetadataHeadView.resolveTitle(page, site);
    const description = MetadataHeadView.text(page.description) || MetadataHeadView.text(site.description);
    const canonical = MetadataHeadView.text((page.alternates as { canonical?: unknown } | null)?.canonical);
    const robots = MetadataHeadView.robots(page.robots);
    const og = MetadataHeadView.record(page.openGraph) ?? MetadataHeadView.record(site.openGraph);
    const twitter = MetadataHeadView.record(page.twitter) ?? MetadataHeadView.record(site.twitter);
    const icons = MetadataHeadView.record(site.icons);
    const other = MetadataHeadView.record(page.other) ?? {};
    return (
      <>
        {title ? <title>{title}</title> : null}
        {description ? <meta name="description" content={description} /> : null}
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        {robots ? <meta name="robots" content={robots} /> : null}
        {MetadataHeadView.openGraph(og, MetadataHeadView.text(site.openGraph && (site.openGraph as { siteName?: unknown }).siteName))}
        {MetadataHeadView.twitter(twitter)}
        {MetadataHeadView.icons(icons)}
        {Object.entries(other).map(([name, value]) => (
          <meta key={`other-${name}`} name={name} content={MetadataHeadView.text(value)} />
        ))}
      </>
    );
  }

  static resolveTitle(page: Metadata, site: Metadata): string {
    const pageTitle = page.title as unknown;
    const siteTitle = site.title as unknown;
    const absolute = MetadataHeadView.text((pageTitle as { absolute?: unknown } | null)?.absolute);
    if (absolute) return absolute;
    const template = MetadataHeadView.text((siteTitle as { template?: unknown } | null)?.template);
    const plain = typeof pageTitle === 'string' ? pageTitle.trim() : '';
    if (plain) return template.includes('%s') ? template.replace('%s', plain) : plain;
    return MetadataHeadView.text((siteTitle as { default?: unknown } | null)?.default) || MetadataHeadView.text(siteTitle);
  }

  private static openGraph(og: Record<string, unknown> | null, fallbackSiteName: string): ReactNode {
    if (!og) return null;
    const images = MetadataHeadView.images(og.images);
    const siteName = MetadataHeadView.text(og.siteName) || fallbackSiteName;
    return (
      <>
        {MetadataHeadView.text(og.title) ? <meta property="og:title" content={MetadataHeadView.text(og.title)} /> : null}
        {MetadataHeadView.text(og.description) ? <meta property="og:description" content={MetadataHeadView.text(og.description)} /> : null}
        {MetadataHeadView.text(og.url) ? <meta property="og:url" content={MetadataHeadView.text(og.url)} /> : null}
        {siteName ? <meta property="og:site_name" content={siteName} /> : null}
        {MetadataHeadView.text(og.type) ? <meta property="og:type" content={MetadataHeadView.text(og.type)} /> : null}
        {images.map((image) => <meta key={`og-image-${image}`} property="og:image" content={image} />)}
      </>
    );
  }

  private static twitter(twitter: Record<string, unknown> | null): ReactNode {
    if (!twitter) return null;
    const images = MetadataHeadView.images(twitter.images);
    return (
      <>
        {MetadataHeadView.text(twitter.card) ? <meta name="twitter:card" content={MetadataHeadView.text(twitter.card)} /> : null}
        {MetadataHeadView.text(twitter.site) ? <meta name="twitter:site" content={MetadataHeadView.text(twitter.site)} /> : null}
        {MetadataHeadView.text(twitter.title) ? <meta name="twitter:title" content={MetadataHeadView.text(twitter.title)} /> : null}
        {MetadataHeadView.text(twitter.description) ? <meta name="twitter:description" content={MetadataHeadView.text(twitter.description)} /> : null}
        {images.map((image) => <meta key={`tw-image-${image}`} name="twitter:image" content={image} />)}
      </>
    );
  }

  private static icons(icons: Record<string, unknown> | null): ReactNode {
    if (!icons) return null;
    return (
      <>
        {MetadataHeadView.text(icons.icon) ? <link rel="icon" href={MetadataHeadView.text(icons.icon)} /> : null}
        {MetadataHeadView.text(icons.shortcut) ? <link rel="shortcut icon" href={MetadataHeadView.text(icons.shortcut)} /> : null}
        {MetadataHeadView.text(icons.apple) ? <link rel="apple-touch-icon" href={MetadataHeadView.text(icons.apple)} /> : null}
      </>
    );
  }

  /** Next's `robots` field: a string, or `{ index, follow }` flags → the `index,follow` directive text. */
  private static robots(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    const flags = value as { index?: boolean; follow?: boolean };
    const parts: string[] = [];
    if (flags.index === false) parts.push('noindex'); else if (flags.index === true) parts.push('index');
    if (flags.follow === false) parts.push('nofollow'); else if (flags.follow === true) parts.push('follow');
    return parts.join(',');
  }

  private static images(value: unknown): string[] {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.map((image) => (typeof image === 'string' ? image : MetadataHeadView.text((image as { url?: unknown } | null)?.url))).filter(Boolean);
  }

  private static record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private static text(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof URL) return value.href;
    if (typeof value === 'object') return '';
    return CoercionUtils.toString(value).trim();
  }
}
