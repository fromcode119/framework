import { CoercionUtils } from '@fromcode119/core';

/**
 * Where a preview link lands after the exchange: the page the operator asked to see.
 *
 * The admin's Preview button on a draft needs to open THAT draft on the site's host, not the home
 * page, so the link carries the path. It is followed by whoever holds the link and redirected to
 * blindly, so it must only ever be a path ON THE SITE ITSELF: anything that could leave the host —
 * a scheme, a protocol-relative `//`, a backslash browsers read as a slash — becomes `/` instead.
 * An open redirect on a login-like handoff is a phishing tool.
 */
export class SitePreviewLandingPath {
  static readonly HOME = '/';
  static readonly QUERY_KEY = 'next';
  private static readonly MAX_LENGTH = 2048;

  /** The path to land on, or `/` when the value is missing or could point anywhere else. */
  static normalize(raw: unknown): string {
    const value = CoercionUtils.toString(raw).trim();
    if (!value || value.length > SitePreviewLandingPath.MAX_LENGTH) return SitePreviewLandingPath.HOME;
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return SitePreviewLandingPath.HOME;
    // Control characters can split a header or be dropped by a browser into a different URL.
    if (/[\u0000-\u001f\u007f]/.test(value)) return SitePreviewLandingPath.HOME;
    return value;
  }
}
