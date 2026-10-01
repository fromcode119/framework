import { ApiPathUtils } from '@core/api/api-path-utils';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';

/**
 * What a plugin a SITE uploaded may answer, beyond the headers the proxy already strips.
 *
 * A DOCUMENT only into a frame. Its HTML (or SVG, or XML a browser renders) is shown inside one of
 * its widgets — a frame in the site's own page, `Sec-Fetch-Dest: iframe` — and nowhere else. Opened
 * as a page of its own it would be a page on the site's real address that the plugin wrote: a sign-in
 * form, a payment form, a "your session expired" screen. The browser says which it is, and a page
 * cannot make a visitor's browser claim a navigation was a frame.
 *
 * A WIDGET may call its own routes. A sandboxed frame has an opaque origin and sends `Origin: null`;
 * the api answers it for a site plugin's own routes, WITHOUT credentials — the proxy never hands a
 * site's plugin the caller's cookies or Authorization anyway.
 */
export class SitePluginResponseRules {
  static readonly DOCUMENT_TYPES = ['text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/xml', 'application/xml'] as const;
  static readonly FRAME_DESTINATIONS = ['iframe', 'frame'] as const;
  static readonly OPAQUE_ORIGIN = 'null';
  static readonly REFUSAL = 'This page belongs to a plugin and can only be shown inside its widget on this site.';

  /**
   * True when the answer would render as a page and the request was not for a frame. A reply with no
   * body to render — `204`, `304`, a redirect — is never one.
   */
  static refusesDocument(status: number, contentType: unknown, fetchDestination: unknown): boolean {
    if (status === 204 || (status >= 300 && status < 400)) return false;
    const type = String(contentType ?? '').split(';')[0].trim().toLowerCase();
    // No type at all lets a browser sniff one, HTML included.
    const document = !type || (SitePluginResponseRules.DOCUMENT_TYPES as readonly string[]).includes(type);
    if (!document) return false;
    const destination = String(fetchDestination ?? '').trim().toLowerCase();
    return !(SitePluginResponseRules.FRAME_DESTINATIONS as readonly string[]).includes(destination);
  }

  /** The slug of the site-uploaded plugin whose route `path` is, or null for anything else. */
  static sitePluginOf(path: string): string | null {
    const base = `${ApiPathUtils.pluginPath('').replace(/\/+$/, '')}/`;
    const clean = String(path ?? '').split('?')[0];
    if (!clean.startsWith(base)) return null;
    const slug = clean.slice(base.length).split('/')[0];
    return slug && PluginOwners.ownerOf(slug) ? slug : null;
  }
}
