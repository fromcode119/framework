import { ThemeMode } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The theme page's row of tabs — Overview, Settings, and Maintenance set apart on the right (the plugin page's style). */
export class ThemeDetailTabs extends PureReactor {
  @prop declare activeTab: ThemeSettingsTab;
  @prop declare onTabChange: (tab: ThemeSettingsTab) => void;
  @prop declare theme: ThemeMode;

  @bound private openOverview(): void { this.onTabChange(ThemeSettingsTab.OVERVIEW); }
  @bound private openSettings(): void { this.onTabChange(ThemeSettingsTab.SETTINGS); }
  @bound private openMaintenance(): void { this.onTabChange(ThemeSettingsTab.MAINTENANCE); }

  private tab(tab: ThemeSettingsTab, label: string, Icon: ComponentType<{ size?: number }>, onClick: () => void, className = ''): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const active = this.activeTab === tab;
    const tone = active
      ? (dark ? 'text-white border-indigo-500' : 'text-slate-900 border-indigo-600')
      : (dark ? 'text-slate-400 border-transparent hover:text-slate-200' : 'text-slate-500 border-transparent hover:text-slate-800');
    return (
      <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
        className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3.5 text-[13px] transition-colors ${active ? 'font-semibold' : 'font-medium'} ${tone} ${className}`}>
        <Icon size={15} />
        {label}
      </button>
    );
  }

  render(): ReactNode {
    return (
      <nav className={`flex gap-6 overflow-x-auto [scrollbar-width:none] border-b px-6 ${this.theme === ThemeMode.DARK ? 'border-slate-800' : 'border-slate-200'}`}>
        {this.tab(ThemeSettingsTab.OVERVIEW, AdminI18n.t('themes.overview'), FrameworkIcons.Info, this.openOverview)}
        {this.tab(ThemeSettingsTab.SETTINGS, AdminI18n.t('themes.settings'), FrameworkIcons.Settings, this.openSettings)}
        {this.tab(ThemeSettingsTab.MAINTENANCE, AdminI18n.t('themes.maintenance'), FrameworkIcons.Wrench, this.openMaintenance, 'ml-auto')}
      </nav>
    );
  }
}
