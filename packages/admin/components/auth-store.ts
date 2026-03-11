"use client";

import { createContext } from 'react';
import type { AuthContextType } from './auth-context.interfaces';

export class AuthStore {
  static readonly context = createContext<AuthContextType | null>(null);
}
