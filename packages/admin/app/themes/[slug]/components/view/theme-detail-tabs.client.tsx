import { Tabs } from '@/components/ui/view/tabs.client';
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

  render(): ReactNode {
    const rows = [
      { tab: ThemeSettingsTab.OVERVIEW, label: AdminI18n.t('themes.overview'), icon: <FrameworkIcons.Info size={15} />, go: this.openOverview },
      { tab: ThemeSettingsTab.SETTINGS, label: AdminI18n.t('themes.settings'), icon: <FrameworkIcons.Settings size={15} />, go: this.openSettings },
      { tab: ThemeSettingsTab.MAINTENANCE, label: AdminI18n.t('themes.maintenance'), icon: <FrameworkIcons.Wrench size={15} />, go: this.openMaintenance, end: true },
    ];
    return (
      <Tabs variant="bar" label={AdminI18n.t('themes.settings')}
        value={String(rows.findIndex((row) => row.tab === this.activeTab))}
        onChange={(index: string) => rows[Number(index)]?.go()}
        tabs={rows.map((row, index) => ({ id: String(index), label: row.label, icon: row.icon, end: row.end }))} />
    );
  }
}
