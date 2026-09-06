import { ApiPathUtils } from '@fromcode119/core/client';

/**
 * One `theme.json` `ui.headLinks[]` entry, resolved. Three `href` forms:
 *  - absolute (`https://…`) — used as is;
 *  - root-relative (`/api/v1/…`) — prefixed with the api origin (theme assets are served by the api);
 *  - bare (`fonts/archivo.woff2`) — a file in the theme's own `ui/` directory, resolved exactly like
 *    `ui.css` entries, so a theme preloads its fonts without spelling any API path.
 * Knows which of the three roles it plays — a `preload` hint, an external stylesheet (injected
 * non-blocking after load), or a plain `<link>` element.
 */
export class ThemeHeadLink {
  private constructor(
    readonly rel: string,
    readonly href: string,
    readonly as: string,
    readonly type: string,
    readonly crossOrigin: string,
    readonly media: string,
    readonly precedence: string,
    readonly fetchPriority: string,
  ) {}

  static from(raw: Record<string, string> | null | undefined, apiUrl: string, themeSlug = ''): ThemeHeadLink | null {
    const rel = String(raw?.rel || '').trim();
    const rawHref = String(raw?.href || '').trim();
    if (!rel || !rawHref) return null;
    const href = rawHref.startsWith('http')
      ? rawHref
      : rawHref.startsWith('/') || !themeSlug ? `${apiUrl}${rawHref}` : ApiPathUtils.themeUiAssetUrl(apiUrl, themeSlug, rawHref);
    return new ThemeHeadLink(
      rel, href,
      String(raw?.as || '').trim(), String(raw?.type || '').trim(), String(raw?.crossOrigin || '').trim(),
      String(raw?.media || '').trim(), String(raw?.precedence || '').trim(), String(raw?.fetchPriority || '').trim(),
    );
  }

  get isPreload(): boolean {
    return this.rel === 'preload';
  }

  get isExternalStylesheet(): boolean {
    return this.rel === 'stylesheet' && this.href.startsWith('https://');
  }

  /** The attributes of the `<link>` element form, only those set. */
  get elementProps(): Record<string, string> {
    const props: Record<string, string> = { rel: this.rel, href: this.href };
    if (this.crossOrigin) props.crossOrigin = this.crossOrigin;
    if (this.as) props.as = this.as;
    if (this.type) props.type = this.type;
    if (this.media) props.media = this.media;
    if (this.precedence) props.precedence = this.precedence;
    if (this.fetchPriority) props.fetchPriority = this.fetchPriority;
    return props;
  }
}
