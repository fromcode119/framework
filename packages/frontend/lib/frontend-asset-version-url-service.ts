/**
 * Stamps the owning theme/plugin's version onto an asset URL.
 *
 * The version is ALWAYS taken from the installed package, never from the URL the manifest wrote.
 * Deferring to a hand-written `?v=` froze one theme's entry at `bundle.js?v=1.0.250`: every upload
 * kept emitting that URL, so browsers reused a cached shim importing an `index-<hash>.js` later
 * builds had deleted, and the storefront 404'd with no way to recover from the admin. A manifest
 * cannot be trusted to keep a version token in sync with its own package version; the runtime can.
 */
export class FrontendAssetVersionUrlService {
  static appendVersion(url: string, version: unknown): string {
    const resolvedUrl = String(url || '').trim();
    const resolvedVersion = String(version || '').trim();
    if (!resolvedUrl || !resolvedVersion) {
      return resolvedUrl;
    }

    try {
      const parsed = new URL(resolvedUrl);
      parsed.searchParams.set('v', resolvedVersion);
      return parsed.toString();
    } catch {
      return FrontendAssetVersionUrlService.stampRelativeUrl(resolvedUrl, resolvedVersion);
    }
  }

  /** `new URL()` rejects relative hrefs (`bundle.js`, `/ui/app.css`), which are the common case. */
  private static stampRelativeUrl(url: string, version: string): string {
    const [pathPart, queryPart = ''] = url.split('#')[0].split('?');
    const fragment = url.includes('#') ? `#${url.split('#').slice(1).join('#')}` : '';
    const params = new URLSearchParams(queryPart);
    params.set('v', version);
    return `${pathPart}?${params.toString()}${fragment}`;
  }
}
