import { describe, it, expect, vi } from 'vitest';

/** What the settings-schema read answers next. A plain function, so a refused read is a plain rejection. */
let answer: () => Promise<unknown> = async () => ({});
vi.mock('@/lib/api', () => ({ AdminApi: { get: () => answer() } }));

import { PluginDetailPageService } from '@/app/plugins/[slug]/plugin-detail-page-service';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';

describe('PluginDetailPageService.fetchSettingsGroups', () => {
  /** A group no tab names would be a page tab that opens onto nothing. */
  it('keeps only the groups some settings tab uses, in the declared order', async () => {
    answer = async () => ({
      groups: [{ id: 'store', label: 'Store' }, { id: 'empty', label: 'Empty' }, { id: 'catalogue', label: 'Catalogue' }],
      tabs: [{ id: 'general', group: 'store' }, { id: 'shopPage', group: 'catalogue' }, { id: 'loose' }],
    });
    expect((await PluginDetailPageService.fetchSettingsGroups('shop')).map((group) => group.id)).toEqual(['store', 'catalogue']);
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
