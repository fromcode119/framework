import { ApiPathUtils } from '@core/api';
import { ApiVersionUtils } from '@core/api-version';
import { ApplicationHostUtils } from '@core/application-host-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { PublicRouteConstants } from '@core/constants/public-route.constants';
import { RuntimeBridge } from '@core/runtime-bridge';
import { EnvUtils } from '@core/utils/env-utils';

export class PublicAssetUrlUtils {
  private static readonly uploadBasePath = String(SystemConstants.STORAGE.DEFAULT_PUBLIC_URL).trim();

  static resolveApiBaseUrl(): string {
    return RuntimeBridge.resolveApiBaseUrl();
  }

  static absoluteUrl(value: any, apiBaseUrl = PublicAssetUrlUtils.resolveApiBaseUrl()): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (PublicAssetUrlUtils.isDirectUrl(raw)) return raw;
    return ApiPathUtils.absoluteUrl(apiBaseUrl, raw.startsWith('/') ? raw : `/${raw}`);
  }

  /**
   * The registered image-optimizer URL builder, or null when nothing registered one.
   *
   * A REGISTRY, not a hardcoded endpoint: the optimizer is owned by whichever plugin ships it, and no
   * consumer may name that plugin (a plugin naming another plugin's slug is an architecture violation,
   * and core naming a plugin is worse). The owner registers its builder on boot; everyone else asks
   * core. Nothing registered ⇒ every helper below returns the original URL, so a site without an
   * optimizer plugin still renders — just unoptimized.
   */
  private static imageOptimizer: ((uploadPath: string, width: number, quality: number) => string) | null = null;

  /** Called once by the plugin that owns the optimizer endpoint, from its storefront/admin UI boot. */
  static registerImageOptimizer(builder: (uploadPath: string, width: number, quality: number) => string): void {
    PublicAssetUrlUtils.imageOptimizer = builder;
  }

  /**
   * An upload image at a target width, through the registered optimizer. Non-uploads (theme assets,
   * remote URLs, data URIs) and an unregistered optimizer both return the input unchanged — the caller
   * always gets a usable `src`.
   */
  static optimizedUploadUrl(url: any, width: number, quality = 60): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const uploadPath = PublicAssetUrlUtils.extractUploadPath(raw);
    if (!uploadPath || !PublicAssetUrlUtils.imageOptimizer) return raw;
    return String(PublicAssetUrlUtils.imageOptimizer(uploadPath, width, quality) || raw);
  }

  /**
   * A `srcset` for an upload image across `widths`, so the browser downloads the size it will display
   * instead of the full-resolution original. Empty string when the image cannot be optimized, which is
   * exactly what an `<img srcSet={...}>` should receive in that case — a srcset of identical URLs at
   * different width descriptors is worse than none, because the browser then picks by descriptor and
   * still downloads the original.
   */
  static responsiveUploadSrcSet(url: any, widths: number[], quality = 60): string {
    const raw = String(url || '').trim();
    if (!raw || !PublicAssetUrlUtils.imageOptimizer) return '';
    if (!PublicAssetUrlUtils.extractUploadPath(raw)) return '';

    const uniqueWidths = Array.from(new Set(
      (Array.isArray(widths) ? widths : [])
        .map((value) => Math.round(Number(value) || 0))
        .filter((value) => Number.isFinite(value) && value > 0),
    )).sort((left, right) => left - right);
    if (!uniqueWidths.length) return '';

    return uniqueWidths
      .map((width) => `${PublicAssetUrlUtils.optimizedUploadUrl(raw, width, quality)} ${width}w`)
      .join(', ');
  }

  /**
   * The optimizable path inside a value, whether it arrived as a path or an absolute URL: an upload, or
   * a theme's own UI asset. Themes ship their own imagery and it is often the heaviest thing on a page,
   * so leaving it out would optimize only half the images on the site. Anything else (remote URL, data
   * URI, SVG) returns null and is served untouched.
   */
  private static extractUploadPath(url: string): string | null {
    const pathname = PublicAssetUrlUtils.toPathname(url);
    if (!pathname) return null;
    if (pathname.startsWith(`${PublicAssetUrlUtils.uploadBasePath}/`)) return pathname;
    // Vector art is already tiny and rasterising it would make it worse.
    if (/\.svg(\?|$)/i.test(pathname)) return null;
    // Derived from the theme-UI route template — see ApiPathUtils.themeUiAssetMatcher.
    if (ApiPathUtils.themeUiAssetMatcher().test(pathname)) return pathname;
    return null;
  }

  private static toPathname(url: string): string {
    if (url.startsWith('/')) return url;
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  }

  static themeAssetUrl(themeSlug: string, assetPath: any, apiBaseUrl = PublicAssetUrlUtils.resolveApiBaseUrl()): string {
    const normalizedAssetPath = PublicAssetUrlUtils.trimLeadingSlashes(assetPath);
    return ApiPathUtils.themeUiAssetUrl(apiBaseUrl, themeSlug, normalizedAssetPath);
  }

  static uploadAssetUrl(assetPath: any, apiBaseUrl = PublicAssetUrlUtils.resolveApiBaseUrl()): string {
    const normalizedUploadPath = PublicAssetUrlUtils.normalizeUploadPath(assetPath);
    if (!normalizedUploadPath) return '';
    return ApiPathUtils.absoluteUrl(apiBaseUrl, normalizedUploadPath);
  }

  static resolveMediaUrl(value: any, apiBaseUrl = PublicAssetUrlUtils.resolveApiBaseUrl()): string {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (raw.startsWith('data:') || raw.startsWith('blob:')) {
      return raw;
    }

    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        const normalizedUploadPath = PublicAssetUrlUtils.normalizeUploadPath(parsed.pathname);
        if (normalizedUploadPath) {
          return ApiPathUtils.absoluteUrl(parsed.origin, normalizedUploadPath);
        }

        if (PublicAssetUrlUtils.isThemePublicPath(parsed.pathname)) {
          return ApiPathUtils.absoluteUrl(parsed.origin, parsed.pathname);
        }

        return raw;
      } catch {
        return raw;
      }
    }

    if (PublicAssetUrlUtils.isThemePublicPath(raw)) {
      return ApiPathUtils.absoluteUrl(apiBaseUrl, raw);
    }

    const normalizedUploadPath = PublicAssetUrlUtils.normalizeUploadPath(raw);
    if (normalizedUploadPath) {
      return ApiPathUtils.absoluteUrl(apiBaseUrl, normalizedUploadPath);
    }

    if (raw.startsWith('/')) {
      return ApiPathUtils.absoluteUrl(apiBaseUrl, raw);
    }

    return raw.includes('.')
      ? PublicAssetUrlUtils.uploadAssetUrl(raw, apiBaseUrl)
      : '';
  }

  static resolveThemeAwareUrl(
    value: any,
    options: {
      themeSlug: string;
      apiBaseUrl?: string;
      themeAssetPrefixes?: string[];
      themeAssetFiles?: string[];
    }
  ): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (PublicAssetUrlUtils.isDirectUrl(raw)) return raw;

    const apiBaseUrl = String(options.apiBaseUrl || PublicAssetUrlUtils.resolveApiBaseUrl()).trim();
    if (PublicAssetUrlUtils.isThemePublicPath(raw)) {
      return ApiPathUtils.absoluteUrl(apiBaseUrl, raw);
    }

    if (PublicAssetUrlUtils.isUploadPath(raw)) {
      return PublicAssetUrlUtils.uploadAssetUrl(raw, apiBaseUrl);
    }

    if (PublicAssetUrlUtils.matchesThemeAsset(raw, options.themeAssetPrefixes, options.themeAssetFiles)) {
      return PublicAssetUrlUtils.themeAssetUrl(options.themeSlug, raw, apiBaseUrl);
    }

    if (raw.includes('/') || raw.includes('.')) return raw;
    return '';
  }

  static appendVersion(url: any, version: any): string {
    const normalizedUrl = String(url || '').trim();
    const normalizedVersion = String(version || '').trim();
    if (!normalizedUrl || !normalizedVersion) {
      return normalizedUrl;
    }

    try {
      const parsedUrl = new URL(
        normalizedUrl,
        EnvUtils.isBrowser() ? window.location.origin : ApplicationHostUtils.LOCALHOST_ORIGIN,
      );
      if (!parsedUrl.searchParams.get('v')) {
        parsedUrl.searchParams.set('v', normalizedVersion);
      }
      return parsedUrl.toString();
    } catch {
      const separator = normalizedUrl.includes('?') ? '&' : '?';
      return `${normalizedUrl}${separator}v=${encodeURIComponent(normalizedVersion)}`;
    }
  }

  private static isDirectUrl(value: string): boolean {
    return /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:');
  }

  private static isThemePublicPath(value: string): boolean {
    return value.startsWith(PublicRouteConstants.THEME_ASSETS_PREFIX);
  }

  private static isUploadPath(value: string): boolean {
    const uploadPrefix = PublicAssetUrlUtils.normalizePath(PublicAssetUrlUtils.uploadBasePath);
    const uploadPrefixWithoutLeadingSlash = uploadPrefix.replace(/^\/+/, '');
    const normalizedValue = PublicAssetUrlUtils.normalizePath(value);

    return normalizedValue === uploadPrefix ||
      normalizedValue.startsWith(`${uploadPrefix}/`) ||
      normalizedValue === uploadPrefixWithoutLeadingSlash ||
      normalizedValue.startsWith(`${uploadPrefixWithoutLeadingSlash}/`);
  }

  private static normalizeUploadPath(value: any): string {
    const normalizedPath = PublicAssetUrlUtils.normalizePath(value);
    if (!normalizedPath) return '';

    const unversionedPath = PublicAssetUrlUtils.stripApiVersionPrefix(normalizedPath);
    if (PublicAssetUrlUtils.isUploadPath(unversionedPath)) {
      return unversionedPath.startsWith('/') ? unversionedPath : `/${unversionedPath}`;
    }

    const filename = unversionedPath.replace(/^\/+/, '');
    if (!filename || filename.includes('/')) {
      return '';
    }

    return `${PublicAssetUrlUtils.normalizePath(PublicAssetUrlUtils.uploadBasePath)}/${filename}`;
  }

  private static matchesThemeAsset(value: string, prefixes?: string[], files?: string[]): boolean {
    const normalizedPrefixes = Array.isArray(prefixes) ? prefixes : [];
    const normalizedFiles = Array.isArray(files) ? files : [];

    return normalizedPrefixes.some((prefix) => String(prefix || '').trim() && value.startsWith(String(prefix).trim())) ||
      normalizedFiles.includes(value);
  }

  private static trimLeadingSlashes(value: any): string {
    return String(value || '').replace(/^\/+/, '');
  }

  private static normalizePath(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
      const parsed = new URL(raw);
      return PublicAssetUrlUtils.normalizePath(parsed.pathname);
    } catch {}

    const withoutQueryOrHash = raw.split('?')[0].split('#')[0].trim();
    if (!withoutQueryOrHash) return '';

    const withLeadingSlash = withoutQueryOrHash.startsWith('/')
      ? withoutQueryOrHash
      : `/${withoutQueryOrHash}`;
    const compacted = withLeadingSlash.replace(/\/{2,}/g, '/');
    if (compacted.length === 1) return compacted;
    return compacted.replace(/\/+$/, '');
  }

  private static stripApiVersionPrefix(pathname: string): string {
    const normalizedPath = PublicAssetUrlUtils.normalizePath(pathname);
    if (!normalizedPath) return '';

    const regexStrippedPath = normalizedPath.replace(/^\/api\/v[^/]+(?=\/|$)/i, '');
    if (regexStrippedPath !== normalizedPath) {
      return PublicAssetUrlUtils.normalizePath(regexStrippedPath || '/');
    }

    const apiPrefix = ApiVersionUtils.prefix();
    if (normalizedPath === apiPrefix) {
      return '/';
    }

    if (normalizedPath.startsWith(`${apiPrefix}/`)) {
      return PublicAssetUrlUtils.normalizePath(normalizedPath.slice(apiPrefix.length));
    }

    return normalizedPath;
  }
}
