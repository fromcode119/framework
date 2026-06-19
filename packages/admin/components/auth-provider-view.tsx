"use client";

import React from 'react';
import { BrowserStateClient, CookieConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AuthUtils } from '@/lib/auth-utils';
import type { User } from './auth-context.interfaces';
import { AuthStore } from './auth-store';
import type { AuthProviderViewProps, AuthProviderViewState } from './auth-provider-view.interfaces';

const browserState = new BrowserStateClient();

/**
 * Hook-free class body of {@link AuthProvider}. The thin functional shim supplies `router`
 * (from `useRouter()`) as a prop; this class holds the user/isLoading state, runs the hydrate
 * logic in componentDidMount (with a mounted flag cleared in componentWillUnmount), and exposes
 * the `login`/`logout` actions through the auth store.
 */
export class AuthProviderView extends React.Component<AuthProviderViewProps, AuthProviderViewState> {
  private isMounted = false;

  constructor(props: AuthProviderViewProps) {
    super(props);
    this.state = { user: null, isLoading: true };
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }

  componentDidMount(): void {
    this.isMounted = true;
    this.hydrateAuthState();
  }

  componentWillUnmount(): void {
    this.isMounted = false;
  }

  private async hydrateAuthState(): Promise<void> {
    const savedUser = browserState.readCookie(CookieConstants.AUTH_USER);

    if (savedUser && savedUser !== 'null' && savedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && parsed.email) {
          if (this.isMounted) {
            this.setState({ user: parsed, isLoading: false });
          }
          return;
        }
      } catch {
        console.error('[AuthProvider] Failed to parse user session');
      }
    }

    try {
      const securityState = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.SECURITY, { noDedupe: true });
      const securityUser = securityState?.user;

      if (securityUser && typeof securityUser === 'object' && securityUser.email) {
        const domain = AuthUtils.getCookieDomain();
        browserState.writeCookie(CookieConstants.AUTH_USER, JSON.stringify(securityUser), {
          path: '/',
          domain,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        });

        if (this.isMounted) {
          this.setState({ user: securityUser });
        }
      }
    } catch (error: any) {
      if (error?.status && error.status !== 401) {
        console.error('[AuthProvider] Failed to restore authenticated user:', error);
      }
    } finally {
      if (this.isMounted) {
        this.setState({ isLoading: false });
      }
    }
  }

  private login(token: string | undefined, userData: User): void {
    // Note: We no longer set the auth token cookie manually on the client.
    // The backend now provides a secure HttpOnly cookie on the correct domain scope.
    // Setting it here again would cause duplicate cookies on different domain levels
    // (e.g. host-only 'admin.framework.local' vs global '.framework.local').

    // We only store the user profile for UI hydration.
    // We set it on the widest possible domain to match the auth token scope.
    const domain = AuthUtils.getCookieDomain();
    browserState.writeCookie(CookieConstants.AUTH_USER, JSON.stringify(userData), {
      path: '/',
      domain,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    });
    this.setState({ user: userData });
    this.props.router.push(AdminConstants.ROUTES.ROOT);
  }

  private async logout(): Promise<void> {
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.LOGOUT);
    } catch (e) {
      console.error("Logout request failed", e);
    }

    AuthUtils.purgeAuth();
    this.setState({ user: null });
    this.props.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
  }

  render(): React.ReactElement {
    const { user, isLoading } = this.state;
    return (
      <AuthStore.context.Provider value={{ user, isLoading, login: this.login, logout: this.logout }}>
        {this.props.children}
      </AuthStore.context.Provider>
    );
  }
}
