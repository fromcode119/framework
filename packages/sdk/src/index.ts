export * from './types';
export * from './logging';
import { FromcodePlugin } from './types';

export function definePlugin(plugin: FromcodePlugin): FromcodePlugin {
  return plugin;
}
