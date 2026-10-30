import { ThemeMode } from '@fromcode119/core/client';
import type { ISettingsTabGroup } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
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

  private icon(name: string | undefined): ComponentType<{ size?: number }> {
    const icons = FrameworkIcons as unknown as Record<string, ComponentType<{ size?: number }>>;
    return (name && icons[name]) || FrameworkIcons.Settings;
  }

  private get currentGroup(): string {
    const groups = this.groups || [];
    return groups.some((group) => group.id === this.activeGroup) ? this.activeGroup : (groups[0]?.id ?? '');
  }

  private tab(key: string, label: string, Icon: ComponentType<{ size?: number }>, active: boolean, onClick: () => void, className = ''): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const tone = active
      ? (dark ? 'text-white border-indigo-500' : 'text-slate-900 border-indigo-600')
      : (dark ? 'text-slate-400 border-transparent hover:text-slate-200' : 'text-slate-500 border-transparent hover:text-slate-800');
    return (
      <button key={key} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
        className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3.5 text-[13px] transition-colors ${active ? 'font-semibold' : 'font-medium'} ${tone} ${className}`}>
        <Icon size={15} />
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
      <nav className={`flex gap-6 overflow-x-auto [scrollbar-width:none] border-b px-6 lg:px-8 ${this.theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white'}`}>
        {this.tab('overview', AdminI18n.t('plugins.detail.overview'), FrameworkIcons.Info, activeTab === PluginDetailTab.OVERVIEW, () => onTabChange(PluginDetailTab.OVERVIEW))}
        {groups.length
          ? groups.map((group) => this.tab(`group-${group.id}`, group.label, this.icon(group.icon), settingsActive && current === group.id, () => onTabChange(PluginDetailTab.SETTINGS, group.id)))
          : this.tab('settings', AdminI18n.t('plugins.detail.configuration'), FrameworkIcons.Settings, settingsActive, () => onTabChange(PluginDetailTab.SETTINGS))}
        {platform && this.platformPart ? this.tab('platform-settings', AdminI18n.t('plugins.detail.platformSettings'), FrameworkIcons.Globe, activeTab === PluginDetailTab.PLATFORM_SETTINGS, () => onTabChange(PluginDetailTab.PLATFORM_SETTINGS), 'ml-auto') : null}
        {platform ? this.tab('permissions', AdminI18n.t('plugins.detail.security'), FrameworkIcons.Shield, activeTab === PluginDetailTab.PERMISSIONS, () => onTabChange(PluginDetailTab.PERMISSIONS), this.platformPart ? '' : 'ml-auto') : null}
        {platform ? this.tab('resources', AdminI18n.t('plugins.detail.resourceLimits'), FrameworkIcons.Zap, activeTab === PluginDetailTab.RESOURCES, () => onTabChange(PluginDetailTab.RESOURCES)) : null}
      </nav>
    );
  }
}
