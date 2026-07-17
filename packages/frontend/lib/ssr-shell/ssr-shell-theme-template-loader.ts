import { ApiPathUtils } from '@fromcode119/core/client';
import { ServerApiUtils } from '../server-api';
import { FrontendAssetVersionUrlService } from '../frontend-asset-version-url-service';
import { SsrShellTemplateMatcher } from './ssr-shell-template-matcher';
import { SsrShellConfigNormalizer } from './ssr-shell-config-normalizer';
import type {
  SsrShellTemplateTarget,
  SsrShellThemeAssets,
  SsrShellThemeConfig,
} from './ssr-shell-theme-template.types';

/**
 * Loads the optional theme-owned SSR shell declared in `theme.json` (`ui.ssrShell`,
 * see `ssr-shell-theme-template.types.ts`).
 *
 * Transport: the template + css are plain files inside the theme's served `ui/`
 * directory, fetched server-to-server through the SAME theme-asset HTTP route + Next
 * data-cache (`revalidate`) pattern the inlined theme CSS in `theme-assets.tsx`
 * already uses — the frontend server cannot read the api's filesystem, and this
 * route/cache pair is the established, cheapest path. Any failure (missing config,
 * bad path, fetch error, empty file) returns null and the caller falls back to the
 * framework's generic shell.
 */
export class SsrShellThemeTemplateLoader {
  private static readonly REVALIDATE_SECONDS = 300;

  static readConfig(theme: Record<string, any> | null | undefined): SsrShellThemeConfig | null {
    return SsrShellConfigNormalizer.normalize(theme?.ui?.ssrShell);
  }

  /**
   * Loads the template matched for the resolved document (first rule wins; see
   * `SsrShellTemplateMatcher`). Only the MATCHED template file is fetched — each
   * distinct file is cached independently by the Next data cache.
   */
  static async load(
    theme: Record<string, any> | null | undefined,
    target: SsrShellTemplateTarget = { slug: '', layout: '' },
    config: SsrShellThemeConfig | null = null,
  ): Promise<SsrShellThemeAssets | null> {
    const resolved = config || SsrShellThemeTemplateLoader.readConfig(theme);
    if (!resolved) return null;
    const template = SsrShellTemplateMatcher.select(resolved.templates, target);
    if (!template) return null;
    try {
      const [html, css] = await Promise.all([
        SsrShellThemeTemplateLoader.fetchThemeUiFile(theme as Record<string, any>, template),
        resolved.css
          ? SsrShellThemeTemplateLoader.fetchThemeUiFile(theme as Record<string, any>, resolved.css)
          : Promise.resolve(''),
      ]);
      if (!html.trim()) return null;
      return { html, css, config: resolved };
    } catch {
      return null;
    }
  }

  private static async fetchThemeUiFile(theme: Record<string, any>, assetPath: string): Promise<string> {
    const apiUrl = ServerApiUtils.buildPublicApiBaseUrl();
    const internalBase = ServerApiUtils.buildInternalApiBaseUrl();
    const publicHref = ApiPathUtils.themeUiAssetUrl(apiUrl, String(theme?.slug || ''), assetPath);
    const versionedHref = FrontendAssetVersionUrlService.appendVersion(publicHref, theme?.version);
    const internalHref = versionedHref.replace(apiUrl, internalBase);
    const response = await fetch(internalHref, {
      next: { revalidate: SsrShellThemeTemplateLoader.REVALIDATE_SECONDS },
    } as RequestInit);
    return response.ok ? response.text() : '';
  }
}
