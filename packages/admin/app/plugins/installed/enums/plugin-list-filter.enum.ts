import { Enum } from '@fromcode119/react-class-components';
import { PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { PluginSwitchState } from '@/app/plugins/installed/plugin-switch-state';

/**
 * The tabs above the installed plugins: which of them the list shows. "On" and "off" are read from the
 * same answer the row's switch shows (`PluginSwitchState`), so a tab never counts a plugin the switch
 * beside it contradicts. A plugin that failed is counted under errors only.
 */
export class PluginListFilter extends Enum {
  static readonly ALL = new PluginListFilter('all', 'plugins.list.tabAll');
  static readonly ACTIVE = new PluginListFilter('active', 'plugins.list.active');
  static readonly OFF = new PluginListFilter('off', 'plugins.list.tabOff');
  static readonly UPDATES = new PluginListFilter('updates', 'plugins.list.tabUpdates');
  static readonly ERRORS = new PluginListFilter('errors', 'plugins.list.tabErrors');

  static readonly ORDER: readonly PluginListFilter[] = [
    PluginListFilter.ALL, PluginListFilter.ACTIVE, PluginListFilter.OFF, PluginListFilter.UPDATES, PluginListFilter.ERRORS,
  ];

  private constructor(value: string, readonly labelKey: string) {
    super(value);
  }

  static failed(plugin: ILoadedPlugin): boolean {
    return Boolean(plugin.error) || plugin.state === PluginState.ERROR;
  }

  matches(plugin: ILoadedPlugin, hasUpdate: boolean): boolean {
    if (this === PluginListFilter.ALL) return true;
    if (this === PluginListFilter.UPDATES) return hasUpdate;
    const failed = PluginListFilter.failed(plugin);
    if (this === PluginListFilter.ERRORS) return failed;
    if (failed) return false;
    const on = new PluginSwitchState(plugin as any).switchedOn;
    return this === PluginListFilter.ACTIVE ? on : !on;
  }
}
