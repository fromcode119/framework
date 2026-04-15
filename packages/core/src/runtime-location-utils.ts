import { ApplicationUrlUtils } from './application-url-utils';
import { RequestSurfaceUtils } from './request-surface-utils';

export class RuntimeLocationUtils {
  static getCurrentPathname(): string {
    return RuntimeLocationUtils.readCurrentUrl()?.pathname || '';
  }

  static toAdminPath(path: string): string {
    return RuntimeLocationUtils.prefixBasePath(
      path,
      RuntimeLocationUtils.resolveCurrentAdminBasePath(),
    );
  }

  static isAdminRuntime(): boolean {
    const currentUrl = RuntimeLocationUtils.readCurrentUrl();
    if (!currentUrl) {
      return false;
    }

    return ApplicationUrlUtils.hasHostRole(currentUrl, ApplicationUrlUtils.ADMIN_APP)
      || RequestSurfaceUtils.isAdminPath(currentUrl.pathname);
  }

  static isFrontendRuntime(): boolean {
    const currentUrl = RuntimeLocationUtils.readCurrentUrl();
    if (!currentUrl) {
      return false;
    }

    return ApplicationUrlUtils.hasHostRole(currentUrl, ApplicationUrlUtils.FRONTEND_APP)
      || RequestSurfaceUtils.isFrontendPath(currentUrl.pathname);
  }

  static getAdminBasePath(): string {
    return ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.ADMIN_APP)
      || RequestSurfaceUtils.ADMIN_BASE_PATH;
  }

  static prefixBasePath(path: string, basePath: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedBasePath = RuntimeLocationUtils.normalizeBasePath(basePath);
    if (!normalizedBasePath) {
      return normalizedPath;
    }
    if (normalizedPath === normalizedBasePath || normalizedPath.startsWith(`${normalizedBasePath}/`)) {
      return normalizedPath;
    }
    return normalizedPath === '/' ? normalizedBasePath : `${normalizedBasePath}${normalizedPath}`;
  }

  private static readCurrentUrl(): URL | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return new URL(window.location.href);
    } catch {
      return null;
    }
  }

  private static resolveCurrentAdminBasePath(): string {
    return RuntimeLocationUtils.inferAdminBasePathFromCurrentPathname()
      || RuntimeLocationUtils.getAdminBasePath();
  }

  private static inferAdminBasePathFromCurrentPathname(): string {
    const pathname = RuntimeLocationUtils.getCurrentPathname();
    if (!pathname) {
      return '';
    }

    const segments = pathname.split('/').filter(Boolean);
    const adminIndex = segments.indexOf('admin');
    if (adminIndex === -1) {
      return '';
    }

    return `/${segments.slice(0, adminIndex + 1).join('/')}`;
  }

  private static normalizeBasePath(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed === '/') {
      return '';
    }

    return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
  }
}