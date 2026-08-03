import type { IPluginLayoutDefinition } from '@core/layout/interfaces/plugin-layout-definition.interface';

export interface IPluginFrontendLayoutRegistration {
  layouts: IPluginLayoutDefinition[];
  namespace: string;
  pluginSlug: string;
}
