import { describe, expect, it } from 'vitest';
import { SiteClockAccess } from '@core/i18n/site-clock-access';

describe('SiteClockAccess', () => {
  it("answers the site's timezone and the clock its language uses", async () => {
    SiteClockAccess.configure(async () => ({ timezone: 'Europe/Sofia', timeFormat: 'locale', locale: 'bg' }));
    expect(await SiteClockAccess.read('site-1')).toEqual({ timeZone: 'Europe/Sofia', hourCycle: 'h23' });
  });

  it('honours a forced 12-hour clock', async () => {
    SiteClockAccess.configure(async () => ({ timezone: 'Europe/Sofia', timeFormat: 'h12', locale: 'bg' }));
    expect((await SiteClockAccess.read('site-1')).hourCycle).toBe('h12');
  });

  it('reads nothing set as UTC on a 24-hour clock rather than guessing a zone', async () => {
    SiteClockAccess.configure(async () => ({}));
    expect(await SiteClockAccess.read(null)).toEqual({ timeZone: 'UTC', hourCycle: 'h23' });
  });

  it('asks the reader for the site it was given', async () => {
    const asked: string[] = [];
    SiteClockAccess.configure(async (tenantId) => { asked.push(tenantId); return {}; });
    await SiteClockAccess.read('site-42');
    expect(asked).toEqual(['site-42']);
  });
});
