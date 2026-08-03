import { ClientType } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

/** Props for the public PluginsProvider. */
export interface IPluginsProviderProps {
  children: ReactNode;
  apiUrl: string;
  clientType: ClientType;
  runtimeModules?: Record<string, any>;
}
