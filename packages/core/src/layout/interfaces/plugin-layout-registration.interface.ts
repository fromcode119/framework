import type { IPluginLayoutDefinition } from '@core/layout/interfaces/plugin-layout-definition.interface';

export interface IPluginLayoutRegistration {
  namespace: string;
  pluginSlug: string;
  layouts: IPluginLayoutDefinition[];
}
