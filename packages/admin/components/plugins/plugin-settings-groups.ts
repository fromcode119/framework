import type { ISettingsTabGroup } from '@fromcode119/core/client';

/**
 * How a plugin's settings tabs sort into the page's tabs when the plugin groups them (`schema.groups`,
 * `group` on a tab). A tab that names no group — or a group the plugin never declared — is collected
 * under one more page tab, so no setting becomes unreachable because its tab was left out of a group.
 */
export class PluginSettingsGroups {
  /** The page tab for tabs outside every declared group. Underscored so no plugin's own group id meets it. */
  static readonly UNGROUPED = '_ungrouped';

  /**
   * The page tabs: each declared group some tab uses, in declared order, then — when any tab is left
   * over — the ungrouped one under `otherLabel`. None when the plugin declares no groups.
   */
  static pageGroups(schema: { groups?: unknown; tabs?: unknown } | null | undefined, otherLabel: string): ISettingsTabGroup[] {
    const groups = PluginSettingsGroups.declared(schema);
    if (!groups.length) return [];
    const tabs = PluginSettingsGroups.tabs(schema);
    const used = groups.filter((group) => tabs.some((tab) => tab.group === group.id));
    const leftOver = tabs.some((tab) => !groups.some((group) => group.id === tab.group));
    return leftOver ? [...used, { id: PluginSettingsGroups.UNGROUPED, label: otherLabel, icon: 'Settings' }] : used;
  }

  /** The settings tabs offered under one page tab; every tab when the plugin declares no groups or none is open. */
  static tabsOf<T extends { group?: string }>(schema: { groups?: unknown; tabs?: T[] } | null | undefined, group: string): T[] {
    const tabs = Array.isArray(schema?.tabs) ? schema.tabs : [];
    const groups = PluginSettingsGroups.declared(schema);
    if (!groups.length || !group) return tabs;
    if (group === PluginSettingsGroups.UNGROUPED) return tabs.filter((tab) => !groups.some((declared) => declared.id === tab.group));
    return tabs.filter((tab) => tab.group === group);
  }

  private static declared(schema: { groups?: unknown } | null | undefined): ISettingsTabGroup[] {
    return Array.isArray(schema?.groups) ? schema.groups.filter((group: ISettingsTabGroup) => Boolean(group?.id)) : [];
  }

  private static tabs(schema: { tabs?: unknown } | null | undefined): Array<{ group?: string }> {
    return Array.isArray(schema?.tabs) ? schema.tabs : [];
  }
}
