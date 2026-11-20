import { Tabs } from '@/components/ui/view/tabs.client';
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

  render(): ReactNode {
    const { activeTab, onTabChange } = this;
    const groups = this.groups || [];
    const settingsActive = activeTab === PluginDetailTab.SETTINGS;
    const current = this.currentGroup;
    const platform = !this.siteScope;
    // One list of tabs, each with what choosing it does, drawn by the console's `Tabs`.
    const rows: Array<{ id: string; label: string; on: boolean; go: () => void; end?: boolean }> = [
      { id: 'overview', label: AdminI18n.t('plugins.detail.overview'), on: activeTab === PluginDetailTab.OVERVIEW, go: () => onTabChange(PluginDetailTab.OVERVIEW) },
      ...(groups.length
        ? groups.map((group) => ({ id: `group-${group.id}`, label: group.label, on: settingsActive && current === group.id, go: () => onTabChange(PluginDetailTab.SETTINGS, group.id) }))
        : [{ id: 'settings', label: AdminI18n.t('plugins.detail.configuration'), on: settingsActive, go: () => onTabChange(PluginDetailTab.SETTINGS) }]),
      ...(platform && this.platformPart ? [{ id: 'platform-settings', label: AdminI18n.t('plugins.detail.platformSettings'), on: activeTab === PluginDetailTab.PLATFORM_SETTINGS, go: () => onTabChange(PluginDetailTab.PLATFORM_SETTINGS), end: true }] : []),
      ...(platform ? [
        { id: 'permissions', label: AdminI18n.t('plugins.detail.security'), on: activeTab === PluginDetailTab.PERMISSIONS, go: () => onTabChange(PluginDetailTab.PERMISSIONS), end: true },
        { id: 'resources', label: AdminI18n.t('plugins.detail.resourceLimits'), on: activeTab === PluginDetailTab.RESOURCES, go: () => onTabChange(PluginDetailTab.RESOURCES), end: true },
      ] : []),
    ];
    return (
      <Tabs variant="bar" label={AdminI18n.t('plugins.detail.overview')}
        value={rows.find((row) => row.on)?.id ?? ''}
        onChange={(id: string) => rows.find((row) => row.id === id)?.go()}
        tabs={rows.map((row) => ({ id: row.id, label: row.label, end: row.end }))} />
    );
  }
}
