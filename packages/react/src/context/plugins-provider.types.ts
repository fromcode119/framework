import type { ReactNode } from 'react';

export type PluginsProviderProps = {
  children: ReactNode;
  apiUrl: string;
  clientType: 'admin-ui' | 'frontend-ui';
  runtimeModules?: Record<string, any>;
};

export type PluginsProviderInternalProps = PluginsProviderProps & {
  providerClass: any;
};
