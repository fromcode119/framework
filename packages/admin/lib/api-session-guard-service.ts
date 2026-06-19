import { AdminConstants } from './constants';
import { AuthUtils } from './auth-utils';
import { AdminPathUtils } from './admin-path';
import { AdminApiHttpService } from './api-http-service';

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
    if (typeof window === 'undefined') {
      return;
    }
    if (AdminPathUtils.stripBase(window.location.pathname) === AdminConstants.ROUTES.AUTH.LOGIN) {
      return;
    }
    if (url.includes(AdminConstants.ENDPOINTS.AUTH.SECURITY) || String(method || 'GET').toUpperCase() !== 'GET') {
      AdminApiSessionGuardService.redirectToExpiredSession(url, status);
      return;
    }

    void AdminApiSessionGuardService.verifySessionExpiry(url, status);
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
