import { Platform } from '@fromcode119/react-class-components';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AuthUtils } from '@/lib/auth-utils';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminApiHttpService } from '@/lib/api-http-service';

export class AdminApiSessionGuardService {
  private static sessionExpiryVerificationPromise: Promise<void> | null = null;

  static handleUnauthorized(response: Response, url: string, method: string = 'GET'): void {
    AdminApiSessionGuardService.handleUnauthorizedStatus(response.status, url, method);
  }

  static handleUnauthorizedStatus(status: number, url: string, method: string = 'GET'): void {
    const shouldPurge = status === 401;

    if (!shouldPurge) {
      return;
    }
    if (url.includes(AdminConstants.ENDPOINTS.AUTH.STATUS) || url.includes(AdminConstants.ENDPOINTS.AUTH.LOGIN)) {
      return;
    }
    if (!Platform.isBrowser) {
      return;
    }
    if (AdminApiSessionGuardService.needsNoSession(AdminPathUtils.fromBrowserPath(window.location.pathname))) {
      return;
    }
    if (url.includes(AdminConstants.ENDPOINTS.AUTH.SECURITY) || String(method || 'GET').toUpperCase() !== 'GET') {
      AdminApiSessionGuardService.redirectToExpiredSession(url, status);
      return;
    }

    void AdminApiSessionGuardService.verifySessionExpiry(url, status);
  }

  /**
   * A screen a signed-out person is meant to be on: signing in, asking for a reset link, setting a new
   * password, the first-run setup. Only the sign-in screen used to count, so the link in a password
   * reset email opened the reset screen and was sent to sign-in a moment later — by the very state the
   * screen exists for.
   */
  static needsNoSession(path: string): boolean {
    return AdminConstants.ROUTES.AUTH.PUBLIC.some((route: string) => path === route || path.startsWith(`${route}/`));
  }

  private static async verifySessionExpiry(url: string, status: number): Promise<void> {
    if (AdminApiSessionGuardService.sessionExpiryVerificationPromise) {
      return AdminApiSessionGuardService.sessionExpiryVerificationPromise;
    }

    AdminApiSessionGuardService.sessionExpiryVerificationPromise = (async () => {
      try {
        const response = await fetch(AdminApiHttpService.getURL(AdminConstants.ENDPOINTS.AUTH.SECURITY), {
          method: 'GET',
          headers: AdminApiHttpService.buildHeaders(undefined),
          credentials: 'include',
        });

        if (response.status !== 401) {
          return;
        }
      } catch {
        return;
      } finally {
        AdminApiSessionGuardService.sessionExpiryVerificationPromise = null;
      }

      AdminApiSessionGuardService.redirectToExpiredSession(url, status);
    })();

    return AdminApiSessionGuardService.sessionExpiryVerificationPromise;
  }

  private static redirectToExpiredSession(url: string, status: number): void {
    console.warn(`[API] ${status} auth failure confirmed for ${url}. Purging session.`);
    AuthUtils.purgeAuth();
    window.location.href = AdminConstants.ADMIN_URLS.AUTH.LOGIN_SESSION_EXPIRED();
  }
}
