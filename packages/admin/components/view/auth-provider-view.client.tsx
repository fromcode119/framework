import type { ReactElement, ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import { BrowserStateClient, CookieConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AuthUtils } from '@/lib/auth-utils';
import type { IUser } from '@/components/interfaces/user.interface';
import { AuthStore } from '@/components/view/auth-store.client';

/**
 * Hook-free class body of {@link AuthProvider}. The thin functional shim supplies `router`
 * (from `useRouter()`) as a prop; this class holds the user/isLoading state, runs the hydrate
 * logic in componentDidMount, and exposes the `login`/`logout` actions through the auth store.
 */
export class AuthProviderView extends Reactor {
  private static readonly browserState = new BrowserStateClient();

  /** Cookie lifetime for the readable user profile, matched to the auth token's scope. */
  private static readonly USER_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

  @prop declare router: { push: (href: string) => void };
  @prop declare children: ReactNode;

  @state private user: IUser | null = null;

  @state private isLoading = true;

  /**
   * Guards the async hydrate from assigning state after unmount. Deliberately not named after the
   * removed React component API of a similar name, to avoid confusion with it.
   */
  private alive = false;

  componentDidMount(): void {
    this.alive = true;
    this.onUnmount(() => { this.alive = false; });
    void this.hydrateAuthState();
  }

  private async hydrateAuthState(): Promise<void> {
    const savedUser = AuthProviderView.browserState.readCookie(CookieConstants.AUTH_USER);

    if (savedUser && savedUser !== 'null' && savedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && parsed.email) {
          if (this.alive) {
            this.user = parsed;
            this.isLoading = false;
          }
          return;
        }
      } catch {
        console.error('[AuthProvider] Failed to parse user session');
      }
    }

    // No client login signal (the `AUTH_USER` cookie is written on every login) → the visitor is logged out.
    // `/auth/security` is auth-guarded, so probing it here only yields a 401 the browser logs as a console
    // error on the login screen. Show login instead of probing. (A valid HttpOnly session whose readable
    // user cookie was cleared re-logs-in rather than silently restoring — rare; login writes both, 7d each.)
    if (!savedUser || savedUser === 'null' || savedUser === 'undefined') {
      if (this.alive) this.isLoading = false;
      return;
    }

    try {
      const securityState = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.SECURITY, { noDedupe: true });
      const securityUser = securityState?.user;

      if (securityUser && typeof securityUser === 'object' && securityUser.email) {
        const domain = AuthUtils.getCookieDomain();
        AuthProviderView.browserState.writeCookie(CookieConstants.AUTH_USER, JSON.stringify(securityUser), {
          path: '/',
          domain,
          maxAgeSeconds: AuthProviderView.USER_COOKIE_MAX_AGE_SECONDS,
        });

        if (this.alive) this.user = securityUser;
      }
    } catch (error: any) {
      if (error?.status && error.status !== 401) {
        console.error('[AuthProvider] Failed to restore authenticated user:', error);
      }
    } finally {
      if (this.alive) this.isLoading = false;
    }
  }

  @bound
  private login(token: string | undefined, userData: IUser): void {
    // Note: We no longer set the auth token cookie manually on the client.
    // The backend now provides a secure HttpOnly cookie on the correct domain scope.
    // Setting it here again would cause duplicate cookies on different domain levels
    // (e.g. host-only 'admin.framework.local' vs global '.framework.local').

    // We only store the user profile for UI hydration.
    // We set it on the widest possible domain to match the auth token scope.
    const domain = AuthUtils.getCookieDomain();
    AuthProviderView.browserState.writeCookie(CookieConstants.AUTH_USER, JSON.stringify(userData), {
      path: '/',
      domain,
      maxAgeSeconds: AuthProviderView.USER_COOKIE_MAX_AGE_SECONDS,
    });
    this.user = userData;
    this.router.push(AdminConstants.ROUTES.ROOT);
  }

  @bound
  private async logout(): Promise<void> {
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.LOGOUT);
    } catch (e) {
      console.error("Logout request failed", e);
    }

    AuthUtils.purgeAuth();
    this.user = null;
    this.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
  }

  private get value(): { user: IUser | null; isLoading: boolean; login: AuthProviderView['login']; logout: AuthProviderView['logout'] } {
    return { user: this.user, isLoading: this.isLoading, login: this.login, logout: this.logout };
  }

  render(): ReactElement {
    return (
      <AuthStore.context.Provider value={this.value}>
        {this.children}
      </AuthStore.context.Provider>
    );
  }
}
