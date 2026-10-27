import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeopleContextProxy } from '@core/plugin/context/people';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { RequestContextUtils } from '@core/context/request-context';

describe('PeopleContextProxy register scope', () => {
  afterEach(() => vi.restoreAllMocks());

  const people = () => PeopleContextProxy.createPeopleProxy({} as any, { db: {} } as any);

  it('registers a field for every tenant on a platform-scope request, which has no tenant', async () => {
    const forEach = vi.spyOn(PerTenantRun, 'forEach').mockResolvedValue(1);
    await RequestContextUtils.storage.run({} as any, () => people().fields.register({ key: 'favouriteColour', type: 'choice' } as any));
    expect(forEach).toHaveBeenCalledTimes(1);
  });

  it('registers a catalog value for every tenant on a platform-scope request', async () => {
    const forEach = vi.spyOn(PerTenantRun, 'forEach').mockResolvedValue(1);
    await RequestContextUtils.storage.run({} as any, () => people().catalogs.register('role', { key: 'staff', label: 'Staff' }));
    expect(forEach).toHaveBeenCalledTimes(1);
  });
});
