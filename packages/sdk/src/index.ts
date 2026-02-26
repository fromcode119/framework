export * from './types/index';
export * from './logging';
export * from './relations';
export { ApiPath, AppPath } from './constants';
export * from './collections';
export * from './localization';
export * from './shortcodes';
export * from './hook-events';
export * from './runtime-bridge';

export * from './api-version';
import { FromcodePlugin } from './types/index';

export function definePlugin(plugin: FromcodePlugin): FromcodePlugin {
  return plugin;
}
