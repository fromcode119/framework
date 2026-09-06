import { ApiPathUtils } from '@fromcode119/core/client';
import { ServerApiUtils } from '@/lib/server-api';

export class ThemeFaviconRouteResolver {
  private static readonly THEME_FAVICON_CANDIDATES = [
    'favicon.ico',
    'favicon.png',
    'favicon.svg',
    'favicon-32x32.png',
    'favicon-16x16.png',
  ];

  /** The root layout declares `icons.apple = '/apple-touch-icon.png'`; these are the theme files that satisfy it. */
  private static readonly THEME_APPLE_TOUCH_ICON_CANDIDATES = [
    'apple-touch-icon.png',
    'apple-touch-icon-180x180.png',
    'apple-touch-icon-precomposed.png',
  ];

  static async resolve(): Promise<{ themeAssetPaths: string[]; frameworkFallbackPath: string }> {
    return ThemeFaviconRouteResolver.resolveCandidates(ThemeFaviconRouteResolver.THEME_FAVICON_CANDIDATES);
  }

  static async resolveAppleTouchIcon(): Promise<{ themeAssetPaths: string[]; frameworkFallbackPath: string }> {
    return ThemeFaviconRouteResolver.resolveCandidates(ThemeFaviconRouteResolver.THEME_APPLE_TOUCH_ICON_CANDIDATES);
  }

  private static async resolveCandidates(candidates: string[]): Promise<{ themeAssetPaths: string[]; frameworkFallbackPath: string }> {
    try {
      const themeSlug = await ThemeFaviconRouteResolver.resolveActiveThemeSlug();
      return {
        themeAssetPaths: themeSlug ? ThemeFaviconRouteResolver.buildThemeAssetPaths(themeSlug, candidates) : [],
        frameworkFallbackPath: '/brand/atlantis-mark-indigo.png',
      };
    } catch (error) {
      console.warn('[ThemeFaviconRouteResolver] Failed to resolve theme favicon:', error);
      return {
        themeAssetPaths: [],
        frameworkFallbackPath: '/brand/atlantis-mark-indigo.png',
      };
    }
  }

  private static buildThemeAssetPaths(themeSlug: string, candidates: string[]): string[] {
    return candidates.map((candidate) =>
      ApiPathUtils.themePublicAssetPath(themeSlug, candidate),
    );
  }

  private static async resolveActiveThemeSlug(): Promise<string> {
    const config = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemFrontendPath()) as Record<string, unknown> | null;
    const activeTheme = config?.activeTheme as Record<string, unknown> | undefined;
    return String(activeTheme?.slug || '').trim();
  }
}