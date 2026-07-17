import { preload } from 'react-dom';
import { ApiPathUtils } from '@fromcode119/core/client';
import { FrontendAssetVersionUrlService } from '../frontend-asset-version-url-service';

/**
 * Emits `<link rel=preload as=font>` for the theme-declared shell fonts, so the very
 * first paint already uses the theme's real typography instead of a fallback face
 * (which would otherwise re-flow when the theme's css finally loads).
 *
 * Entries are one of:
 *  - a ROOT-RELATIVE url (`/api/v1/themes/...`) — emitted verbatim, so it resolves
 *    against the DOCUMENT origin,
 *  - an absolute http(s) URL — emitted verbatim,
 *  - a theme ui path (`fonts/x.woff2`) — resolved against the api origin + versioned.
 *
 * The `@font-face` rules themselves live in the theme's own css — the framework only
 * warms the fetches. `crossOrigin` is mandatory for font preloads.
 *
 * A preload only pays off when its url is BYTE-IDENTICAL to the url the `@font-face`
 * later requests; otherwise it is a pure duplicate download that also competes for
 * bandwidth with the render-critical path. A theme whose css uses root-relative font
 * urls (they resolve against the document origin once the css is inlined into the
 * document head) must therefore declare its shell fonts root-relative too — the
 * versioned api-origin form below would never be matched by such css.
 */
export class SsrShellFontPreloader {
  static preloadAll(
    fonts: string[] | undefined,
    assetBaseUrl: string,
    themeSlug: string,
    themeVersion: unknown,
  ): void {
    for (const font of Array.isArray(fonts) ? fonts : []) {
      const href = /^(https?:\/\/|\/)/i.test(font)
        ? font
        : FrontendAssetVersionUrlService.appendVersion(
            ApiPathUtils.themeUiAssetUrl(assetBaseUrl, themeSlug, font),
            themeVersion,
          );
      preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous', fetchPriority: 'high' });
    }
  }
}
