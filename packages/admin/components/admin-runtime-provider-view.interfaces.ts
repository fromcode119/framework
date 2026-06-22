import type React from 'react';
import type { AdminRuntimeValue } from './admin-runtime-context.interfaces';

export interface AdminRuntimeProviderViewProps {
  children: React.ReactNode;
  theme: AdminRuntimeValue['theme'];
  toggleTheme: AdminRuntimeValue['toggleTheme'];
  notify: AdminRuntimeValue['notify'];
  globalSettings: Record<string, any>;
  plugins: AdminRuntimeValue['plugins'];
  collections: any[];
  router: AdminRuntimeValue['router'];
  pathname: AdminRuntimeValue['pathname'];
  auth: AdminRuntimeValue['auth'];
  activeAppearanceId: string;
}
