import Cookies from 'js-cookie';
import { Platform } from '@fromcode119/react-class-components';
import { CookieConstants } from '@fromcode119/core/client';

/**
 * Authentication browser utilities (cookie management).
 */
export class AuthUtils {
  /**
   * Aggressively purges all authentication cookies across the current host
   * and all possible parent domain variations to resolve session conflicts.
   */
  static purgeAuth(): void {
    if (!Platform.isBrowser) return;

    const cookiesToClear = [...CookieConstants.AUTH_COOKIES_TO_CLEAR];
    const hostname = window.location.hostname;
    const domains = [hostname, '.' + hostname];

    // If we are on a subdomain (e.g. admin.framework.local),
    // calculate the apex domain (framework.local) and its variations.
    if (hostname.includes('.') && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const root = parts.slice(-2).join('.');
        domains.push(root);
        domains.push('.' + root);
      }
    }

    cookiesToClear.forEach(name => {
      // 1. Clear via js-cookie (handles most cases)
      Cookies.remove(name, { path: '/' });
      domains.forEach(d => {
        Cookies.remove(name, { path: '/', domain: d });
      });

      // 2. Clear via raw document.cookie (set expiry to 1970 to force expiration)
      const expiry = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
      document.cookie = `${name}=; path=/; ${expiry}`;
      domains.forEach(d => {
        document.cookie = `${name}=; path=/; domain=${d}; ${expiry}`;
      });
    });

    console.log(`[AuthUtils] Purged cookies for domains: ${domains.join(', ')}`);
  }

  /**
   * Calculates the current domain scope for cookie setting.
   * Returns the apex domain (e.g. `.example.com`) or undefined for localhost/IP.
   */
  static getCookieDomain(): undefined {
    // ALWAYS host-scoped, never the apex.
    //
    // This wrote the readable user cookie to `.example.com`, so it travelled to every console on the
    // domain. Two things followed: a workspace domain the account had no membership on painted a
    // complete signed-in admin from it, and it sat beside a session cookie that is now host-scoped —
    // an identity in a wider scope than the session it describes is exactly the mismatch that produced
    // both bugs. The browser binds a cookie with no domain to the host that set it, which is what the
    // admin wants: one console, one session.
    return undefined;
  }
}
