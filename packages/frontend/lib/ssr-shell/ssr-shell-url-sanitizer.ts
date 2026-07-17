import { ApiPathUtils } from '@fromcode119/core/client';
import type { SsrShellUrlKind, SsrShellUrlOptions } from './ssr-shell-theme-template.types';

/**
 * Sanitizes theme-declared URL values before they reach the shell HTML.
 *
 * A declared token/list field marked `url` is never trusted verbatim: only http(s),
 * root-relative and (for assets) theme-resolved paths survive — `javascript:`,
 * `data:`, protocol-relative (`//host`) and traversal (`..`) values resolve to '',
 * which also drops the surrounding list item.
 *
 * Two kinds, because the two uses differ:
 *  - `link`  — navigation hrefs: kept verbatim (a root-relative link must stay
 *              same-app; absolutizing it against the api host would break it);
 *  - `asset` — media the browser fetches: root-relative paths are absolutized against
 *              the public asset base, and a bare relative path (`images/…`) resolves
 *              to the active theme's served ui asset URL.
 */
export class SsrShellUrlSanitizer {
  private static readonly SAFE_RELATIVE_RE = /^[a-z0-9][a-z0-9._/-]*$/i;

  static sanitize(value: string, kind: SsrShellUrlKind, options: SsrShellUrlOptions = {}): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//') || raw.includes('..')) return '';
    if (kind === 'link') return raw.startsWith('/') ? raw : '';

    const base = String(options.assetBaseUrl || '').trim().replace(/\/+$/, '');
    if (raw.startsWith('/')) return base ? `${base}${raw}` : raw;
    const themeSlug = String(options.themeSlug || '').trim();
    if (!themeSlug || !SsrShellUrlSanitizer.SAFE_RELATIVE_RE.test(raw)) return '';
    return ApiPathUtils.themeUiAssetUrl(base, themeSlug, raw);
  }
}
