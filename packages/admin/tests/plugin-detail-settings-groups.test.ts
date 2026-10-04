import { describe, it, expect, vi } from 'vitest';

/** What the settings-schema read answers next. A plain function, so a refused read is a plain rejection. */
let answer: () => Promise<unknown> = async () => ({});
vi.mock('@/lib/api', () => ({ AdminApi: { get: () => answer() } }));

import { PluginDetailPageService } from '@/app/plugins/[slug]/plugin-detail-page-service';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { PluginSettingsGroups } from '@/components/plugins/plugin-settings-groups';

describe('PluginDetailPageService.fetchSettingsGroups', () => {
  /** A group no tab names would open onto nothing; a tab no group holds would be unreachable. */
  it('keeps the groups some tab uses, in declared order, then one for the tabs left over', async () => {
    answer = async () => ({
      groups: [{ id: 'store', label: 'Store' }, { id: 'empty', label: 'Empty' }, { id: 'catalogue', label: 'Catalogue' }],
      tabs: [{ id: 'general', group: 'store' }, { id: 'shopPage', group: 'catalogue' }, { id: 'loose' }],
    });
    expect((await PluginDetailPageService.fetchSettingsGroups('shop')).map((group) => group.id)).toEqual(['store', 'catalogue', PluginSettingsGroups.UNGROUPED]);
  });

  it('returns none for a plugin that declares no groups — the page shows one Configuration tab', async () => {
    answer = async () => ({ tabs: [{ id: 'general' }] });
    expect(await PluginDetailPageService.fetchSettingsGroups('plain')).toEqual([]);
  });

  it('returns none when the schema cannot be read', async () => {
    answer = async () => { throw new Error('404'); };
    expect(await PluginDetailPageService.fetchSettingsGroups('missing')).toEqual([]);
  });
});

describe('PluginDetailPageService.tabHref', () => {
  it('records the tab, group and section, keeping other parameters', () => {
    expect(PluginDetailPageService.tabHref('/plugins/shop', '?site=a', PluginDetailTab.SETTINGS, 'store', 'checkout'))
      .toBe('/plugins/shop?site=a&tab=settings&group=store&section=checkout');
  });

  /** A stale group or section from the last tab must not follow the operator to Overview. */
  it('drops an empty group and section', () => {
    expect(PluginDetailPageService.tabHref('/plugins/shop', '?tab=settings&group=store&section=checkout', PluginDetailTab.OVERVIEW, '', ''))
      .toBe('/plugins/shop?tab=overview');
  });
});

describe('PluginSettingsGroups', () => {
  const schema = {
    groups: [{ id: 'store', label: 'Store' }, { id: 'catalogue', label: 'Catalogue' }],
    tabs: [{ id: 'general', group: 'store' }, { id: 'feeds', group: 'catalogue' }, { id: 'loose' }, { id: 'typo', group: 'stor' }],
  };

  it('adds no extra page tab when every tab sits in a declared group', () => {
    expect(PluginSettingsGroups.pageGroups({ groups: schema.groups, tabs: schema.tabs.slice(0, 2) }, 'Other').map((group) => group.id)).toEqual(['store', 'catalogue']);
  });

  it('offers a group only its own tabs', () => {
    expect(PluginSettingsGroups.tabsOf(schema, 'store').map((tab) => tab.id)).toEqual(['general']);
  });

  /** A tab with no group, or one naming a group nobody declared, must still be reachable. */
  it('collects every tab outside the declared groups under the extra page tab', () => {
    expect(PluginSettingsGroups.tabsOf(schema, PluginSettingsGroups.UNGROUPED).map((tab) => tab.id)).toEqual(['loose', 'typo']);
  });

  it('offers every tab when the plugin declares no groups', () => {
    expect(PluginSettingsGroups.tabsOf({ tabs: schema.tabs }, 'store')).toHaveLength(4);
  });
});
