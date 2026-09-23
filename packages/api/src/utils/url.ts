import { ApplicationUrlUtils, SiteBaseUrl } from '@fromcode119/core';
import { Request } from 'express';

export class ApiUrlUtils {
  static normalizePath(raw: string | null | undefined): string {
        let value = String(raw || '').trim();
        if (!value) return '';

        // Handle absolute URLs (strip protocol/host to get pathname)
        if (/^https?:\/\//i.test(value)) {
            try {
                value = new URL(value).pathname || '';
            } catch {
                // Ignore malformed URL and continue
            }
        }

        // Strip query strings and hash anchors
        value = value.split('?')[0].split('#')[0].trim();
        if (!value) return '';

        // Ensure leading slash and remove redundant internal slashes
        value = value.startsWith('/') ? value : `/${value}`;
        value = value.replace(/\/{2,}/g, '/');

        // Remove trailing slash if length > 1
        if (value.length > 1) {
            value = value.replace(/\/+$/, '');
        }

        return value;

  }

  private static safeGetHeader(req: Request, header: string): string | undefined {
    return typeof req.get === 'function' ? req.get(header) : undefined;
  }

  static isHttps(req: Request): boolean {
        return req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

  }

  static getRequestHostAndProto(req: Request): { host: string; proto: string } {
    const host = String(ApiUrlUtils.safeGetHeader(req, 'x-forwarded-host') || ApiUrlUtils.safeGetHeader(req, 'host') || '').split(',')[0].trim();
    const proto = String(ApiUrlUtils.safeGetHeader(req, 'x-forwarded-proto') || (req.protocol === 'https' ? 'https' : 'http')).split(',')[0].trim();
    return { host, proto: proto || 'http' };
  }

  static getRequestOrigin(req: Request): string {
        const candidates = [ApiUrlUtils.safeGetHeader(req, 'origin'), ApiUrlUtils.safeGetHeader(req, 'referer')];
        for (const raw of candidates) {
            const value = String(raw || '').trim();
            if (!value) continue;
            try {
                const parsed = new URL(value);
                return `${parsed.protocol}//${parsed.host}`;
            } catch {
                continue;
            }
        }

        const { host, proto } = ApiUrlUtils.getRequestHostAndProto(req);
        return host ? `${proto}://${host}` : '';

  }

  static resolvePublicUrl(req: Request, resourcePath: string | null | undefined): string {
        return ApiUrlUtils.joinPublicUrl(ApiUrlUtils.resolveApiPublicOrigin(req), resourcePath);
  }

  /**
   * The origin a file uploaded by the CURRENT SITE is reachable at.
   *
   * A site's uploads are written into its own directory (`uploads/tenants/<id>/`) and `/uploads` is
   * served per HOST — `TenantUploadsStatic` resolves the site from the host and tries that site's
   * directory before the shared root. The platform's api host names no site, so a URL built on it
   * can only ever reach the shared root, where a file written since sites had their own directories
   * is not. Every such file therefore had a URL that 404'd: the admin's media library drew a generic
   * file icon for every new upload. On the site's own host the same path resolves, and a file that
   * predates per-site directories still falls through to the root.
   *
   * With no site bound (platform scope, a single-site deployment) this is the api origin, as before.
   */
  static async resolveSitePublicOrigin(req: Request): Promise<string> {
        const site = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.API_APP);
        return site || ApiUrlUtils.resolveApiPublicOrigin(req);
  }

  /**
   * A stored file's public URL, addressed to `origin` — the current site's (see
   * `resolveSitePublicOrigin`).
   *
   * The storage driver may hand back an ABSOLUTE URL: `STORAGE_PUBLIC_URL` is usually configured as
   * the platform api's `/uploads`, so every file comes back already fixed to a host that names no
   * site. That URL is REBASED onto `origin` when it sits on the platform api's origin; anything on
   * another origin (a CDN, an object store) is left exactly as it is, and a relative one is joined.
   */
  static sitePublicUrl(origin: string, resourcePath: string | null | undefined): string {
        const value = String(resourcePath || '').trim();
        const platform = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP).replace(/\/+$/, '');
        const site = String(origin || '').replace(/\/+$/, '');
        if (platform && site && site !== platform && value.startsWith(`${platform}/`)) {
            return `${site}${value.slice(platform.length)}`;
        }
        return ApiUrlUtils.joinPublicUrl(origin, value);
  }

  /** `resourcePath` made absolute on `origin`; external, data and blob URLs pass through untouched. */
  static joinPublicUrl(origin: string, resourcePath: string | null | undefined): string {
        const value = String(resourcePath || '').trim();
        if (!value) return '';

        // Return early for external URLs or data/blob URIs
        if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
            return value;
        }

        const normalizedPath = value.startsWith('/') ? value : `/${value}`;
        const base = String(origin || '').replace(/\/+$/, '');
        return base ? `${base}${normalizedPath}` : normalizedPath;
  }

  static resolveApiPublicOrigin(req: Request): string {
        const configuredApiBaseUrl = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(
            ApplicationUrlUtils.API_APP,
        );
        if (configuredApiBaseUrl) {
            return configuredApiBaseUrl;
        }

        const requestOrigin = ApiUrlUtils.getRequestOrigin(req);
        if (!requestOrigin) {
            return '';
        }

        return ApplicationUrlUtils.translateBaseUrlToApp(
            requestOrigin,
            ApplicationUrlUtils.API_APP,
        ) || requestOrigin;

  }

  static resolveStoragePublicUrlBase(rawValue?: string, defaultPublicUrl = '/uploads'): string {
        const value = String(rawValue || process.env.STORAGE_PUBLIC_URL || '').trim();
        if (!value) return defaultPublicUrl;
        if (/^https?:\/\//i.test(value)) {
            return value.replace(/\/+$/, '');
        }
        return value.startsWith('/') ? value : `/${value}`;

  }

  static resolveStoragePublicPath(rawValue?: string, defaultPublicUrl = '/uploads'): string {
        const base = ApiUrlUtils.resolveStoragePublicUrlBase(rawValue, defaultPublicUrl);
        if (/^https?:\/\//i.test(base)) {
            try {
                const parsed = new URL(base);
                const pathname = String(parsed.pathname || '').trim();
                if (!pathname) return defaultPublicUrl;
                return pathname.startsWith('/') ? pathname : `/${pathname}`;
            } catch {
                return defaultPublicUrl;
            }
        }
        return base.startsWith('/') ? base : `/${base}`;

  }

  static getRequestHostname(req: Request): string {
        const host = String(req.get('x-forwarded-host') || req.get('host') || req.hostname || '').split(',')[0].trim();
        return host.split(':')[0];

  }

  static getCookieDomain(hostnameOrReq: string | Request): string | undefined {
        const hostname = typeof hostnameOrReq === 'string' 
            ? hostnameOrReq 
            : ApiUrlUtils.getRequestHostname(hostnameOrReq);

        // If it's an IP address or localhost, we don't set a domain (let browser handle it by host)
        if (!hostname || hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            return undefined;
        }

        const parts = hostname.split('.');
        if (parts.length >= 2) {
            return '.' + parts.slice(-2).join('.');
        }

        return undefined;

  }
}
