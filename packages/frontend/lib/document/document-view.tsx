import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { DocumentHeadView } from '@/lib/document/document-head-view';
import type { ThemeHeadModel } from '@/lib/document/theme-head-model';
import { PageDocPrefetcher } from '@/lib/theme/page-doc-prefetcher';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';
import type { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';
import { StructuredDataScriptsView } from '@/components/structured-data-scripts';
import { StorefrontDocumentContract } from '@/lib/document/storefront-document-contract';
import { SitePreviewBannerView } from '@/lib/document/site-preview-banner-view';
import { SiteBannersView } from '@/lib/document/site-banners-view';

/**
 * The whole islands document as one synchronous React tree, rendered to static markup by
 * `StorefrontDocumentRenderer`. Nothing in here fetches: every input was resolved by the renderer.
 *
 * Body order: the preview banner (only when this render is a preview) → plugin body-start injections → `#fc-root` holding the server-rendered theme (the tree
 * `hydrateRoot` adopts; its innerHTML is `ThemeSsrMarkup.bodyHtml`, produced in this process by the
 * theme's own server bundle) → JSON-LD → the page-scoped prefetch script → the runtime config JSON.
 * The config is serialised with the prefetch script's escaping (`<`, `>`, `&` → unicode escapes), so
 * content can never close the script element.
 */
export class DocumentView {
  static render({ lang, page, site, theme, markup, headInjections, bodyStartInjections, preview, schema, pageDocPrefetch, runtimeConfig, runtimeScriptPath, layoutStylesheets }: {
    lang: string;
    page: Metadata;
    site: Metadata;
    theme: ThemeHeadModel | null;
    markup: ThemeSsrMarkup | null;
    headInjections: ReactElement[];
    bodyStartInjections: ReactElement[];
    /** Whether this render is somebody looking at a site that is not published yet. */
    preview: boolean;
    schema: string[];
    pageDocPrefetch: Record<string, unknown>;
    runtimeConfig: Record<string, unknown>;
    runtimeScriptPath: string;
    layoutStylesheets: string[];
    status: number;
  }): ReactNode {
    return (
      <html lang={lang}>
        <DocumentHeadView.render page={page} site={site} theme={theme} markup={markup} injections={headInjections} runtimeScriptPath={runtimeScriptPath} layoutStylesheets={layoutStylesheets} />
        <body>
          {/* FIRST in the body, ahead of the theme and ahead of any plugin injection, so nothing a
              theme renders can sit above it or paint over it. */}
          <SiteBannersView.render bars={[SitePreviewBannerView.render({ visible: preview })]} />
          {bodyStartInjections}
          <div id={StorefrontDocumentContract.ROOT_ID} dangerouslySetInnerHTML={{ __html: markup?.bodyHtml || '' }} />
          <StructuredDataScriptsView.render schema={schema} />
          {Object.keys(pageDocPrefetch).length ? <script dangerouslySetInnerHTML={{ __html: PageDocPrefetcher.buildMergeScript(pageDocPrefetch) }} /> : null}
          <script type="application/json" id={StorefrontDocumentContract.CONFIG_ELEMENT_ID} dangerouslySetInnerHTML={{ __html: ThemeDataPrefetcher.safeSerialize(runtimeConfig) }} />
        </body>
      </html>
    );
  }
}
