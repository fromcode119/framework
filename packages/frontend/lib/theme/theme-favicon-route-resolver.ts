import { existsSync } from 'node:fs';
import path from 'node:path';
import { ProjectPaths } from '@fromcode119/core';
import { ServerApiUtils } from '@/lib/server-api';

export class ThemeFaviconRouteResolver {
  private static readonly THEME_FAVICON_CANDIDATES = [
    'public/favicon.ico',
    'public/favicon.png',
    'public/favicon.svg',
    'public/favicon-32x32.png',
    'public/favicon-16x16.png',
    'ui/favicon.ico',
    'ui/favicon.png',
    'ui/favicon.svg',
    'ui/favicon-32x32.png',
    'ui/favicon-16x16.png',
  ];

  static async resolve(): Promise<{ filePath: string; contentType: string } | null> {
    try {
      const themeSlug = await ThemeFaviconRouteResolver.resolveActiveThemeSlug();
      const resolvedThemeIcon = themeSlug
        ? ThemeFaviconRouteResolver.resolveThemeIcon(themeSlug)
        : null;
      if (resolvedThemeIcon) {
        return resolvedThemeIcon;
      }
    } catch (error) {
      console.warn('[ThemeFaviconRouteResolver] Failed to resolve theme favicon:', error);
    }

    return ThemeFaviconRouteResolver.resolveFrameworkFallback();
  }

  private static resolveThemeIcon(themeSlug: string): { filePath: string; contentType: string } | null {
    const themeRoot = path.join(ProjectPaths.getThemesDir(), themeSlug);
    for (const candidate of ThemeFaviconRouteResolver.THEME_FAVICON_CANDIDATES) {
      const filePath = path.join(themeRoot, candidate);
      if (!existsSync(filePath)) {
        continue;
      }

      return {
        filePath,
        contentType: ThemeFaviconRouteResolver.resolveContentType(filePath),
      };
    }

    return null;
  }

  private static resolveFrameworkFallback(): { filePath: string; contentType: string } | null {
    const fallbackCandidates = [
      path.join(ProjectPaths.getPackagesDir(), 'frontend', 'public', 'brand', 'atlantis-mark-indigo.png'),
      path.join(ProjectPaths.getPackagesDir(), 'frontend', 'public', 'brand', 'atlantis-mark-indigo.svg'),
    ];

    for (const filePath of fallbackCandidates) {
      if (!existsSync(filePath)) {
        continue;
      }

      return {
        filePath,
        contentType: ThemeFaviconRouteResolver.resolveContentType(filePath),
      };
    }

    return null;
  }

  private static async resolveActiveThemeSlug(): Promise<string> {
    const config = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemFrontendPath()) as Record<string, unknown> | null;
    const activeTheme = config?.activeTheme as Record<string, unknown> | undefined;
    return String(activeTheme?.slug || '').trim();
  }

  private static resolveContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.svg') {
      return 'image/svg+xml';
    }
    if (extension === '.png') {
      return 'image/png';
    }
    return 'image/x-icon';
  }
}