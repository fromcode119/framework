import { ApiVersionUtils } from '../api-version';
import { SystemConstants } from '../constants';
import { RouteConstants } from '../route-constants';

export class ApiPathUtils {
  static fillPath(pathTemplate: string, params?: Record<string, string | number>): string {
    let resolvedPath = String(pathTemplate || '').trim();

    Object.entries(params || {}).forEach(([key, value]) => {
      resolvedPath = resolvedPath.replaceAll(`:${key}`, encodeURIComponent(String(value)));
    });

    return resolvedPath;
  }

  private static ensureLeadingSlash(value: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private static trimOuterSlashes(value: string): string {
    return String(value || '').trim().replace(/^\/+|\/+$/g, '');
  }

  private static join(basePath: string, ...segments: string[]): string {
    const base = ApiPathUtils.ensureLeadingSlash(basePath).replace(/\/+$/, '');
    const suffix = segments
      .map((segment) => ApiPathUtils.trimOuterSlashes(segment))
      .filter(Boolean)
      .join('/');

    return suffix ? `${base}/${suffix}` : base;
  }

  static versioned(path: string): string {
    return `${ApiVersionUtils.prefix()}${ApiPathUtils.ensureLeadingSlash(path)}`;
  }

  static authPath(path = ''): string {
    return ApiPathUtils.versioned(ApiPathUtils.join(SystemConstants.API_PATH.AUTH.BASE, path));
  }

  static systemPath(path = ''): string {
    return ApiPathUtils.versioned(ApiPathUtils.join(SystemConstants.API_PATH.SYSTEM.BASE, path));
  }

  static systemFrontendPath(): string {
    return ApiPathUtils.versioned(SystemConstants.API_PATH.SYSTEM.FRONTEND);
  }

  static systemI18nPath(): string {
    return ApiPathUtils.versioned(SystemConstants.API_PATH.SYSTEM.I18N);
  }

  static adminApiBasePath(): string {
    return ApiPathUtils.join(RouteConstants.SEGMENTS.ADMIN_BASE, 'api');
  }

  static adminGlobalPath(slug: string): string {
    return ApiPathUtils.join('/globals', slug);
  }

  static adminCollectionPath(slug: string): string {
    return ApiPathUtils.join('', slug);
  }

  static pluginPath(slug: string, path = ''): string {
    return ApiPathUtils.versioned(ApiPathUtils.join(SystemConstants.API_PATH.PLUGINS.BASE, slug, path));
  }

  static themePath(slug: string, path = ''): string {
    return ApiPathUtils.versioned(ApiPathUtils.join(SystemConstants.API_PATH.THEMES.BASE, slug, path));
  }
}
