import { ApiPathUtils } from './api';
import { ApiVersionUtils } from './api-version';
import { SystemConstants } from './constants';
import { PublicRouteConstants } from './public-route-constants';
import { RuntimeBridge } from './runtime-bridge';

export class PublicAssetUrlUtils {
  private static readonly uploadBasePath = String(SystemConstants.STORAGE.DEFAULT_PUBLIC_URL || '/uploads').trim() || '/uploads';

  static resolveApiBaseUrl(): string {
    return RuntimeBridge.resolveApiBaseUrl();
  }

  static absoluteUrl(value: any, apiBaseUrl = PublicAssetUrlUtils.resolveApiBaseUrl()): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (PublicAssetUrlUtils.isDirectUrl(raw)) return raw;
    return ApiPathUtils.absoluteUrl(apiBaseUrl, raw.startsWith('/') ? raw : `/${raw}`);
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