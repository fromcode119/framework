import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformSettingsService, SettingChangeInvalidators, SystemConstants } from '@fromcode119/core';
import { PlatformRobotsHeaderMiddleware } from '@api/middlewares/platform-robots-header-middleware';
import { QueryHelper } from '@api/services/query-helper';

/** Values an operator saves must be in force on the next request, not after a TTL or a restart. */
describe('saved settings take effect without waiting', () => {
  afterEach(() => {
    SettingChangeInvalidators.reset();
    vi.restoreAllMocks();
  });

  it('turning search indexing OFF refuses indexing on the very next response', async () => {
    const flag = vi.spyOn(PlatformSettingsService, 'readFlag').mockResolvedValue(true);
    const robots = new PlatformRobotsHeaderMiddleware();
    const respond = () => {
      const headers: Record<string, string> = {};
      robots.middleware()({} as any, { setHeader: (k: string, v: string) => { headers[k] = v; } } as any, () => undefined);
      return headers;
    };
    respond();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Object.keys(respond())).toEqual([]);

    flag.mockResolvedValue(false);
    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING, tenantId: null }]);

    expect(Object.keys(respond()).length).toBe(1);
  });

  it('a collection whose fields changed gets a table built from the new fields', () => {
    const collection: any = { slug: 'live_shape_probe', fields: [{ name: 'title', type: 'text' }] };
    const before = QueryHelper.getVirtualTable(collection);
    expect(QueryHelper.getVirtualTable(collection)).toBe(before);

    collection.fields = [...collection.fields, { name: 'subtitle', type: 'text' }];
    const after = QueryHelper.getVirtualTable(collection);

    expect(after).not.toBe(before);
    expect((after as any).subtitle).toBeDefined();
  });
});
