import type { FromcodePlugin } from './types/plugin.interfaces';

export type PluginModule = Omit<FromcodePlugin, 'manifest'>;

export interface ThemeModule {
  layouts?: Record<string, any>;
  init?: () => void;
}
