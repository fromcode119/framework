"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

interface User {
  id: string;
  email: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing session profile (token is in HttpOnly cookie, we can't read it)
    const savedUser = Cookies.get('fc_user');

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Failed to parse user session");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string | undefined, userData: User) => {
    // Note: token is now handled by HttpOnly cookie from backend
    // We only save the user profile for UI purposes
    Cookies.set('fc_user', JSON.stringify(userData), { expires: 7, path: '/' });
    setUser(userData);
    router.push('/');
  };

  const logout = async () => {
    try {
      await api.post(ENDPOINTS.AUTH.LOGOUT);
    } catch (e) {
      console.error("Logout request failed", e);
    }
    Cookies.remove('fc_token', { path: '/' }); // Clean up any old tokens
    Cookies.remove('fc_user', { path: '/' });
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
