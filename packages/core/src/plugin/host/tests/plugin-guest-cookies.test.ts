import { describe, expect, it } from 'vitest';
import { PluginGuestCookies } from '@core/plugin/host/plugin-guest-cookies';

describe('a plugin request carries the caller\'s cookies', () => {
  it('parses them as the api does: first value wins, values decoded', () => {
    expect(PluginGuestCookies.parse('fc_consent_vid=abc; theme=dark%20blue; fc_consent_vid=other; =x; bare'))
      .toEqual({ fc_consent_vid: 'abc', theme: 'dark blue' });
  });

  it('keeps a value whose escape is malformed, and strips quotes', () => {
    expect(PluginGuestCookies.parse('a=%E0%A4%A; b="quoted"')).toEqual({ a: '%E0%A4%A', b: 'quoted' });
  });

  it('sets req.cookies from the header, and leaves cookies another layer already parsed', () => {
    const req: any = { headers: { cookie: 'fc_token=t1' } };
    PluginGuestCookies.restore(req, {} as any, () => undefined);
    expect(req.cookies).toEqual({ fc_token: 't1' });
    const parsed: any = { headers: { cookie: 'fc_token=t1' }, cookies: { fc_token: 'kept' } };
    PluginGuestCookies.restore(parsed, {} as any, () => undefined);
    expect(parsed.cookies).toEqual({ fc_token: 'kept' });
  });

  it('gives a request without a Cookie header an empty object, never undefined', () => {
    const req: any = { headers: {} };
    PluginGuestCookies.restore(req, {} as any, () => undefined);
    expect(req.cookies).toEqual({});
  });
});
