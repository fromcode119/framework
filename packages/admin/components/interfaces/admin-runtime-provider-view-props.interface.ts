import type React from 'react';
import type { IAdminRuntimeValue } from '@/components/interfaces/admin-runtime-value.interface';

export interface IAdminRuntimeProviderViewProps {
  children: React.ReactNode;
  theme: IAdminRuntimeValue['theme'];
  toggleTheme: IAdminRuntimeValue['toggleTheme'];
  notify: IAdminRuntimeValue['notify'];
  globalSettings: Record<string, any>;
  plugins: IAdminRuntimeValue['plugins'];
  collections: any[];
  router: IAdminRuntimeValue['router'];
  pathname: IAdminRuntimeValue['pathname'];
  params: IAdminRuntimeValue['params'];
  auth: IAdminRuntimeValue['auth'];
  activeAppearanceId: string;
}
