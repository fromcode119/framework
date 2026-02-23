import { Request } from 'express';

/**
 * Robustly normalizes a path (extracts pathname from absolute URLs, removes query/hash, etc.).
 */
export function normalizePath(raw: string | null | undefined): string {
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

/**
 * Checks if the request is secure (HTTPS).
 */
export function isHttps(req: Request): boolean {
    return req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
}

/**
 * Extracts host and protocol from the request, respecting X-Forwarded headers.
 */
export function getRequestHostAndProto(req: Request): { host: string; proto: string } {
    const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const proto = String(req.get('x-forwarded-proto') || (req.protocol === 'https' ? 'https' : 'http')).split(',')[0].trim();
    return { host, proto: proto || 'http' };
}

/**
 * Returns the full origin from the request, preferring Origin or Referer headers.
 */
export function getRequestOrigin(req: Request): string {
    const candidates = [req.get('origin'), req.get('referer')];
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

    const { host, proto } = getRequestHostAndProto(req);
    return host ? `${proto}://${host}` : '';
}

/**
 * Resolves a public URL for a given resource path, handling external URLs and data URIs.
 */
export function resolvePublicUrl(req: Request, resourcePath: string | null | undefined): string {
    const value = String(resourcePath || '').trim();
    if (!value) return '';
    
    // Return early for external URLs or data/blob URIs
    if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
        return value;
    }
    
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    const origin = getRequestOrigin(req);
    return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

/**
 * Base logic for storage public URL resolution.
 */
export function resolveStoragePublicUrlBase(rawValue?: string, defaultPublicUrl = '/uploads'): string {
    const value = String(rawValue || process.env.STORAGE_PUBLIC_URL || '').trim();
    if (!value) return defaultPublicUrl;
    if (/^https?:\/\//i.test(value)) {
        return value.replace(/\/+$/, '');
    }
    return value.startsWith('/') ? value : `/${value}`;
}

/**
 * Returns only the pathname part of the storage public URL.
 */
export function resolveStoragePublicPath(rawValue?: string, defaultPublicUrl = '/uploads'): string {
    const base = resolveStoragePublicUrlBase(rawValue, defaultPublicUrl);
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

/**
 * Extracts the hostname from the request, respecting X-Forwarded headers.
 */
export function getRequestHostname(req: Request): string {
    const host = String(req.get('x-forwarded-host') || req.get('host') || req.hostname || '').split(',')[0].trim();
    return host.split(':')[0];
}

/**
 * Extracts the root domain for session cookies from a hostname or request.
 */
export function getCookieDomain(hostnameOrReq: string | Request): string | undefined {
    const hostname = typeof hostnameOrReq === 'string' 
        ? hostnameOrReq 
        : getRequestHostname(hostnameOrReq);

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
