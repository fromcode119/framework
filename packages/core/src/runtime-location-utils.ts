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
    // In a live admin runtime the current pathname is authoritative: its `/admin` segment
    // (or the absence of one) IS the real admin base path. A dedicated admin host served at
    // root has no `/admin` segment, so the base is '' (root) — returning the configured
    // `/admin` default here would produce broken `/admin/...` links. Only fall back to the
    // configured default when there is no current pathname to read (e.g. during SSR).
    if (RuntimeLocationUtils.getCurrentPathname()) {
      return RuntimeLocationUtils.inferAdminBasePathFromCurrentPathname();
    }
    return RuntimeLocationUtils.getAdminBasePath();
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