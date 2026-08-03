import { createContext } from 'react';
import type { IThemeContextType } from '@/components/interfaces/theme-context-type.interface';

export class ThemeContext {
  static readonly context = createContext<IThemeContextType | undefined>(undefined);
}
