import { ApiPathUtils } from './api';
import { SystemConstants } from './constants';
import { PublicRouteConstants } from './public-route-constants';
import { RuntimeBridge } from './runtime-bridge';

export class PublicAssetUrlUtils {
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
    const uploadPrefix = String(SystemConstants.STORAGE.DEFAULT_PUBLIC_URL || '').trim();
    const uploadPrefixWithoutLeadingSlash = uploadPrefix.replace(/^\/+/, '');

    return value === uploadPrefix ||
      value.startsWith(`${uploadPrefix}/`) ||
      value === uploadPrefixWithoutLeadingSlash ||
      value.startsWith(`${uploadPrefixWithoutLeadingSlash}/`);
  }

  private static normalizeUploadPath(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('/')) return raw;
    return `/${raw}`;
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
}