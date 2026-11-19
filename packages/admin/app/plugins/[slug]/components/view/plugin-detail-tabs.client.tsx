import { ThemeMode } from '@fromcode119/core/client';
import type { ISettingsTabGroup } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The band of tabs under the page's header: Overview, then the plugin's settings — one tab per group it declares, or a
 * single "Settings" — and, set apart on the right, the platform's Security and Resources.
 */
export class PluginDetailTabs extends PureReactor {
  @prop declare activeTab: PluginDetailTab;
  @prop declare activeGroup: string;
  @prop declare groups: ISettingsTabGroup[];
  @prop declare onTabChange: (tabId: PluginDetailTab, group?: string) => void;
  @prop declare theme: ThemeMode;
  /** In a site only its own tabs are offered; the platform's (Security, Resources) live in Platform scope. */
  @prop declare siteScope: boolean;
  /** The plugin declares a platform part (`manifest.platform`), so it has platform settings to offer. */
  @prop declare platformPart: boolean;


  private get currentGroup(): string {
    const groups = this.groups || [];
    return groups.some((group) => group.id === this.activeGroup) ? this.activeGroup : (groups[0]?.id ?? '');
  }

  private tab(key: string, label: string, active: boolean, onClick: () => void, className = ''): ReactNode {
    // The console's one tab, the same as `Tabs` draws. These were underlined in the brand's indigo —
    // a second kind of tab, on the screen every plugin's settings open on.
    return (
      <button key={key} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
        className={`fc-tab${active ? ' fc-tab--on' : ''} ${className}`}>
        {label}
      </button>
    );
  }

  render(): ReactNode {
    const { activeTab, onTabChange } = this;
    const groups = this.groups || [];
    const settingsActive = activeTab === PluginDetailTab.SETTINGS;
    const current = this.currentGroup;
    const platform = !this.siteScope;
    return (
      <nav className="fc-tabs fc-tabbar">
        {this.tab('overview', AdminI18n.t('plugins.detail.overview'), activeTab === PluginDetailTab.OVERVIEW, () => onTabChange(PluginDetailTab.OVERVIEW))}
        {groups.length
          ? groups.map((group) => this.tab(`group-${group.id}`, group.label, settingsActive && current === group.id, () => onTabChange(PluginDetailTab.SETTINGS, group.id)))
          : this.tab('settings', AdminI18n.t('plugins.detail.configuration'), settingsActive, () => onTabChange(PluginDetailTab.SETTINGS))}
        {platform && this.platformPart ? this.tab('platform-settings', AdminI18n.t('plugins.detail.platformSettings'), activeTab === PluginDetailTab.PLATFORM_SETTINGS, () => onTabChange(PluginDetailTab.PLATFORM_SETTINGS), 'ml-auto') : null}
        {platform ? this.tab('permissions', AdminI18n.t('plugins.detail.security'), activeTab === PluginDetailTab.PERMISSIONS, () => onTabChange(PluginDetailTab.PERMISSIONS), this.platformPart ? '' : 'ml-auto') : null}
        {platform ? this.tab('resources', AdminI18n.t('plugins.detail.resourceLimits'), activeTab === PluginDetailTab.RESOURCES, () => onTabChange(PluginDetailTab.RESOURCES)) : null}
      </nav>
    );
  }
}
