import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PluginDetailTabs extends PureReactor {
  private static readonly SITE_TABS: readonly PluginDetailTab[] = [PluginDetailTab.OVERVIEW, PluginDetailTab.SETTINGS];

  @prop declare activeTab: PluginDetailTab;
  @prop declare onTabChange: (tabId: PluginDetailTab) => void;
  @prop declare theme: ThemeMode;
  /** In a site only its own tabs are offered; the platform's (Security, Resource Limits) live in Platform scope. */
  @prop declare siteScope: boolean;

  render(): ReactNode {
    const { activeTab, onTabChange, theme } = this;
    const tabs = [
      { id: PluginDetailTab.OVERVIEW, label: AdminI18n.t('plugins.detail.overview'), icon: FrameworkIcons.Plugins },
      { id: PluginDetailTab.SETTINGS, label: AdminI18n.t('plugins.detail.configuration'), icon: FrameworkIcons.Settings },
      { id: PluginDetailTab.PERMISSIONS, label: AdminI18n.t('plugins.detail.security'), icon: FrameworkIcons.Shield },
      { id: PluginDetailTab.RESOURCES, label: AdminI18n.t('plugins.detail.resourceLimits'), icon: FrameworkIcons.Zap },
    ].filter((tab) => !this.siteScope || PluginDetailTabs.SITE_TABS.includes(tab.id));

    return (
      <div className={`flex gap-2 p-1 ${AdminClass.SURFACE} w-fit backdrop-blur border transition-all duration-300 ${theme === ThemeMode.DARK ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-sm'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id.value}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all rounded-lg ${activeTab === tab.id ? (theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400 shadow-sm shadow-indigo-500/10' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50') : (theme === ThemeMode.DARK ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>
    );
  }
}
