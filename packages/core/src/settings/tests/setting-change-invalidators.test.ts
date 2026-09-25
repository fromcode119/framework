import { afterEach, describe, expect, it } from 'vitest';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { SiteLocaleAccess } from '@core/i18n/site-locale-access';
import { SystemConstants } from '@core/constants/system.constants';

describe('SettingChangeInvalidators', () => {
  afterEach(() => SettingChangeInvalidators.reset());

  it('scopes the drop by the row that was written, not by the site the admin had selected', () => {
    const seen: Array<string | null> = [];
    SettingChangeInvalidators.register(['k'], (tenantId) => seen.push(tenantId));

    SettingChangeInvalidators.dispatch([{ key: 'k', tenantId: 'site-a' }]);
    SettingChangeInvalidators.dispatch([{ key: 'k', tenantId: null }]);

    expect(seen).toEqual(['site-a', null]);
  });

  it('runs a cache once per save however many of its keys changed, and a platform write covers a site write', () => {
    const seen: Array<string | null> = [];
    SettingChangeInvalidators.register(['a', 'b'], (tenantId) => seen.push(tenantId));

    SettingChangeInvalidators.dispatch([{ key: 'a', tenantId: 'site-a' }, { key: 'b', tenantId: 'site-a' }]);
    SettingChangeInvalidators.dispatch([{ key: 'a', tenantId: 'site-a' }, { key: 'b', tenantId: null }]);

    expect(seen).toEqual(['site-a', null]);
  });

  it('one cache that throws does not leave the next one stale', () => {
    let reached = false;
    SettingChangeInvalidators.register(['k'], () => { throw new Error('boom'); });
    SettingChangeInvalidators.register(['k'], () => { reached = true; });

    SettingChangeInvalidators.dispatch([{ key: 'k', tenantId: 'site-a' }]);

    expect(reached).toBe(true);
  });

  it('a saved site locale is re-read on the next request', async () => {
    let stored = 'en';
    SiteLocaleAccess.configure(async () => stored);
    await SiteLocaleAccess.warm('site-a');
    expect(SiteLocaleAccess.get('site-a')).toBe('en');

    stored = 'bg';
    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.DEFAULT_LOCALE, tenantId: 'site-a' }]);
    await SiteLocaleAccess.warm('site-a');

    expect(SiteLocaleAccess.get('site-a')).toBe('bg');
  });
});
