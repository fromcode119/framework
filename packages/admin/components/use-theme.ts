"use client";

import { useContext } from 'react';
import type { ThemeContextType } from './theme-context.interfaces';
import { ThemeContext } from './theme-context-store';

export class ThemeHooks {
  static useTheme(): ThemeContextType {
    const context = useContext(ThemeContext.context);
    if (!context) {
      throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
  }
}
