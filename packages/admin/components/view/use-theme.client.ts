import { useContext } from 'react';
import type { IThemeContextType } from '@/components/interfaces/theme-context-type.interface';
import { ThemeContext } from '@/components/view/theme-context-store.client';

export class ThemeHooks {
  static useTheme(): IThemeContextType {
    const context = useContext(ThemeContext.context);
    if (!context) {
      throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
  }
}
