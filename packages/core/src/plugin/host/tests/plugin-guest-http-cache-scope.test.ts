import { describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';

describe('the cache scope the api hands a plugin process with each request', () => {
  it('round-trips the revision and the age limit', () => {
    const raw = PluginGuestHttp.encodeCacheScope({ revision: 'mfx1a2b3c.4.7', cacheMaxAgeMs: 60_000 });
    expect(PluginGuestHttp.decodeCacheScope(raw)).toEqual({ revision: 'mfx1a2b3c.4.7', cacheMaxAgeMs: 60_000 });
  });

  it('keeps nothing for an off setting, a missing value or a malformed one', () => {
    for (const raw of [PluginGuestHttp.encodeCacheScope({ revision: 'r', cacheMaxAgeMs: 0 }), '', ';r', 'abc;r', '5000;', 'nonsense']) {
      expect(PluginGuestHttp.decodeCacheScope(raw).cacheMaxAgeMs).toBe(0);
      expect(PluginGuestHttp.decodeCacheScope(raw).revision).toBeUndefined();
    }
  });

  it('is one of the headers only the api may write — a client\'s copy never reaches the plugin', () => {
    expect(PluginGuestHttp.PRIVATE_HEADERS).toContain(PluginGuestHttp.HEADER_CACHE);
  });
});
