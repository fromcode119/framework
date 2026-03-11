"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AuthUtils } from '@/lib/auth-utils';
import type { User } from './auth-context.interfaces';
import { AuthStore } from './auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing session profile (token is in HttpOnly cookie, we can't read it)
    const savedUser = Cookies.get('fc_user');

    if (savedUser && savedUser !== 'null' && savedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && parsed.email) {
          setUser(parsed);
        }
      } catch (err) {
        console.error("Failed to parse user session");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string | undefined, userData: User) => {
    // Note: We no longer set 'fc_token' manually on the client. 
    // The backend now provides a secure HttpOnly cookie on the correct domain scope.
    // Setting it here again would cause duplicate cookies on different domain levels
    // (e.g. host-only 'admin.framework.local' vs global '.framework.local').
    
    // We only store the user profile for UI hydration.
    // We set it on the widest possible domain to match the auth token scope.
    const domain = AuthUtils.getCookieDomain();
    const cookieOptions: any = { expires: 7, path: '/' };
    if (domain) cookieOptions.domain = domain;

    Cookies.set('fc_user', JSON.stringify(userData), cookieOptions);
    setUser(userData);
    router.push(AdminConstants.ROUTES.ROOT);
  };

  const logout = async () => {
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.LOGOUT);
    } catch (e) {
      console.error("Logout request failed", e);
    }

    AuthUtils.purgeAuth();
    setUser(null);
    router.push(AdminConstants.ROUTES.AUTH.LOGIN);
  };

  return (
    <AuthStore.context.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthStore.context.Provider>
  );
}
