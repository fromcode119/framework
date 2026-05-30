import type { PluginLayoutDefinition } from '../../types/layout/layout.interfaces';

export interface PluginFrontendLayoutRegistrarOptions {
  namespace: string;
  pluginSlug: string;
}

export interface PluginFrontendLayoutRegistration {
  layouts: PluginLayoutDefinition[];
  namespace: string;
  pluginSlug: string;
}