import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseCache, RequestContextUtils, SiteContentRevision } from '@fromcode119/core';
import { LocalizationService } from '@api/services/localization-service';

/**
 * Every collection read loaded the WHOLE settings table to find five locale keys. They are read once per
 * site and kept until its content revision moves (a settings save) or the operator's cache age passes.
 */
describe('LocalizationService locale settings', () => {
  beforeEach(() => { ApiResponseCache.reset(); ApiResponseCache.useMaxAge(() => 60); });
  afterEach(() => { ApiResponseCache.reset(); vi.useRealTimers(); });

  const service = (rows: Array<{ key: string; value: string }>) => {
    const db = { find: vi.fn(async (_table: string, options: any) => rows.filter((r) => options?.where?.key?.in?.includes(r.key))) };
    return { db, svc: new LocalizationService(db as any) };
  };
  const contextFor = (svc: LocalizationService, site: string) =>
    RequestContextUtils.storage.run({ tenantId: site } as any, () => svc.getLocaleContext({ query: {}, headers: {} }));

  it('reads only the locale keys, once per site and revision', async () => {
    const { db, svc } = service([{ key: 'default_locale', value: 'bg' }, { key: 'enabled_locales', value: 'bg,en' }, { key: 'smtp_password', value: 'x' }]);
    const first = await contextFor(svc, 'site-a');
    await contextFor(svc, 'site-a');
    expect(first.defaultLocale).toBe('bg');
    expect(first.chain).toEqual(['bg', 'en']);
    expect(db.find).toHaveBeenCalledTimes(1);
    expect(db.find.mock.calls[0][1].where.key.in).not.toContain('smtp_password');
  });

  it('reads again once the site changes (a settings save moves its revision), and per site', async () => {
    const rows = [{ key: 'default_locale', value: 'bg' }];
    const { db, svc } = service(rows);
    await contextFor(svc, 'site-b');
    rows[0].value = 'en';
    RequestContextUtils.storage.run({ tenantId: 'site-b' } as any, () => SiteContentRevision.bumpCurrentSite());
    expect((await contextFor(svc, 'site-b')).defaultLocale).toBe('en');
    await contextFor(svc, 'site-c');
    expect(db.find).toHaveBeenCalledTimes(3);
  });

  it('keeps nothing with the operator\'s cache age at 0', async () => {
    ApiResponseCache.useMaxAge(() => 0);
    const { db, svc } = service([{ key: 'default_locale', value: 'bg' }]);
    await contextFor(svc, 'site-d');
    await contextFor(svc, 'site-d');
    expect(db.find).toHaveBeenCalledTimes(2);
  });
});
