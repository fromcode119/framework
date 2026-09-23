import { describe, expect, it } from 'vitest';
import { SiteLocaleAccess } from '@core/i18n/site-locale-access';
import { RequestContextUtils } from '@core/context/request-context';

describe('SiteLocaleAccess — a site issues documents in its own language', () => {
  it('loads a site\'s own default locale once, and answers "" for a site with none', async () => {
    let reads = 0;
    SiteLocaleAccess.configure(async (tenantId) => { reads += 1; return tenantId === 'bg-site' ? 'BG' : ''; });
    await SiteLocaleAccess.warm('bg-site');
    await SiteLocaleAccess.warm('bg-site');
    await SiteLocaleAccess.warm('plain-site');
    expect(SiteLocaleAccess.get('bg-site')).toBe('bg');
    expect(SiteLocaleAccess.get('plain-site')).toBe('');
    expect(SiteLocaleAccess.get(undefined)).toBe('');
    expect(reads).toBe(2);
  });

  it('a saved locale is re-read: one site on its own save, every site on a platform save', async () => {
    let value = 'bg';
    SiteLocaleAccess.configure(async () => value);
    await SiteLocaleAccess.warm('a');
    await SiteLocaleAccess.warm('b');
    value = 'de';
    SiteLocaleAccess.invalidate('a');
    await SiteLocaleAccess.warm('a');
    await SiteLocaleAccess.warm('b');
    expect([SiteLocaleAccess.get('a'), SiteLocaleAccess.get('b')]).toEqual(['de', 'bg']);
    SiteLocaleAccess.invalidate();
    await SiteLocaleAccess.warm('b');
    expect(SiteLocaleAccess.get('b')).toBe('de');
  });

  it('a failed read is not cached — the next request tries again', async () => {
    let fail = true;
    SiteLocaleAccess.configure(async () => { if (fail) throw new Error('db down'); return 'bg'; });
    await SiteLocaleAccess.warm('x');
    expect(SiteLocaleAccess.get('x')).toBe('');
    fail = false;
    await SiteLocaleAccess.warm('x');
    expect(SiteLocaleAccess.get('x')).toBe('bg');
  });

  it('the request context carries it, and has none outside a site', () => {
    RequestContextUtils.storage.run({ tenantId: 's', siteLocale: 'bg' }, () => expect(RequestContextUtils.getSiteLocale()).toBe('bg'));
    RequestContextUtils.storage.run({ tenantId: 's' }, () => expect(RequestContextUtils.getSiteLocale()).toBeUndefined());
    expect(RequestContextUtils.getSiteLocale()).toBeUndefined();
  });
});
