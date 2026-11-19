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
    const active = this.activeTab === tab;
    // The console's one tab (`fc-tab`); these were underlined in the brand's indigo.
    return (
      <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
        className={`fc-tab${active ? ' fc-tab--on' : ''} ${className}`}>
        <Icon size={15} />
        {label}
      </button>
    );
  }

  render(): ReactNode {
    return (
      <nav className="fc-tabs fc-tabbar">
        {this.tab(ThemeSettingsTab.OVERVIEW, AdminI18n.t('themes.overview'), FrameworkIcons.Info, this.openOverview)}
        {this.tab(ThemeSettingsTab.SETTINGS, AdminI18n.t('themes.settings'), FrameworkIcons.Settings, this.openSettings)}
        {this.tab(ThemeSettingsTab.MAINTENANCE, AdminI18n.t('themes.maintenance'), FrameworkIcons.Wrench, this.openMaintenance, 'ml-auto')}
      </nav>
    );
  }
}
