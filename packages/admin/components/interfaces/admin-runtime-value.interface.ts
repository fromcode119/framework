import type { useRouter } from 'next/navigation';
import type { IThemeContextType } from '@/components/interfaces/theme-context-type.interface';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import type { IAuthContextType } from '@/components/interfaces/auth-context-type.interface';

/**
 * Hook-derived values that admin components need but which are only reachable through React
 * hooks (theme, notifications, global settings, plugin registry). Read ONCE by the single
 * functional boundary (AdminRuntimeProvider) and published via AdminRuntimeContext so admin
 * components can be pure, hook-free `React.Component` classes (see AdminComponent).
 *
 * Note: this covers the context-backed hooks. Components depending on data/controller hooks
 * (useModel, useController, useRegistration, …) cannot be classes and stay function components.
 */
export interface IAdminRuntimeValue {
  theme: IThemeContextType['theme'];
  toggleTheme: IThemeContextType['toggleTheme'];
  notify: INotificationContextType;
  globalSettings: Record<string, any>;
  plugins: any;
  collections: any[];
  /** App Router navigation (`next/navigation`) — lets hook-free classes navigate without `useRouter`. */
  router: ReturnType<typeof useRouter>;
  /** Current pathname (`usePathname`) — published so classes need no hook. */
  pathname: string;
  /** Current route params (`useParams`) — context-backed like router/pathname, so classes need no hook. */
  params: Record<string, string | string[]>;
  /** Auth context (`useAuth`) — context-backed, so classes read it via `this.auth` not a hook. */
  auth: IAuthContextType;
  /** Resolved active admin appearance id (selection result). 'default' = built-in appearance. */
  activeAppearanceId: string;
}
