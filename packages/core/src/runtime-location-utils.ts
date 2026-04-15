import { ApplicationUrlUtils } from './application-url-utils';
import { RequestSurfaceUtils } from './request-surface-utils';

export class RuntimeLocationUtils {
  static getCurrentPathname(): string {
    return RuntimeLocationUtils.readCurrentUrl()?.pathname || '';
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
}