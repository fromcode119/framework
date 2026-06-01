import type { ThemeContextType } from '@/components/theme-context.interfaces';
import type { NotificationContextType } from '@/components/notification-context.interfaces';

/**
 * Hook-derived values that admin components need but which are only reachable through React
 * hooks (theme, notifications, global settings, plugin registry). Read ONCE by the single
 * functional boundary (AdminRuntimeProvider) and published via AdminRuntimeContext so admin
 * components can be pure, hook-free `React.Component` classes (see AdminComponent).
 *
 * Note: this covers the context-backed hooks. Components depending on data/controller hooks
 * (useModel, useController, useRegistration, …) cannot be classes and stay function components.
 */
export interface AdminRuntimeValue {
  theme: ThemeContextType['theme'];
  toggleTheme: ThemeContextType['toggleTheme'];
  notify: NotificationContextType;
  globalSettings: Record<string, any>;
  plugins: any;
  collections: any[];
}
