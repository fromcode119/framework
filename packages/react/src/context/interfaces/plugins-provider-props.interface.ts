import { ClientType } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import type { PluginsProviderSeed } from '@react/context/plugins-provider-seed';

/** Props for the public PluginsProvider. */
export interface IPluginsProviderProps {
  children: ReactNode;
  apiUrl: string;
  clientType: ClientType;
  runtimeModules?: Record<string, any>;
  /** Initial provider state (islands runtime); absent, the provider starts from its own defaults. */
  seed?: PluginsProviderSeed;
}
