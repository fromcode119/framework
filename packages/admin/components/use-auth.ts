"use client";

import { useContext } from 'react';
import type { AuthContextType } from './auth-context.interfaces';
import { AuthStore } from './auth-store';

export class AuthHooks {
  static useAuth(): AuthContextType {
    const context = useContext(AuthStore.context);
    if (!context) {
      throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
  }
}
