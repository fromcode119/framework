"use client";

import { createContext } from 'react';
import type { ThemeContextType } from './theme-context.interfaces';

export class ThemeContext {
  static readonly context = createContext<ThemeContextType | undefined>(undefined);
}
