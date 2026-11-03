import { describe, expect, it } from 'vitest';
import { StoredApiAddressesWithoutVersionMigration } from '@core/database/migrations/069_stored_api_addresses_without_version';

/** The pattern is POSIX-ARE compatible, so JavaScript reads it the same way Postgres does. */
const rewrite = (value: string) => value.replace(
  new RegExp(StoredApiAddressesWithoutVersionMigration.pattern('/api'), 'g'),
  '$1/api/',
);

describe('StoredApiAddressesWithoutVersionMigration', () => {
  it('rewrites a relative address of this api wherever content stores one', () => {
    expect(rewrite('/api/v1/themes/fromcode/ui/images/hero.webp')).toBe('/api/themes/fromcode/ui/images/hero.webp');
    expect(rewrite('"/api/v1/themes/snapbilt/ui/images/video-poster.webp"')).toBe('"/api/themes/snapbilt/ui/images/video-poster.webp"');
    expect(rewrite('{"siteLogo": "/api/v1/themes/x/ui/logo.png", "og": "/api/v1/plugins/cms/img?src=1"}'))
      .toBe('{"siteLogo": "/api/themes/x/ui/logo.png", "og": "/api/plugins/cms/img?src=1"}');
    expect(rewrite('<img src=\\"/api/v1/uploads/a.png\\"> url(/api/v1/themes/x/ui/f.woff2) src=/api/v2/x/'))
      .toBe('<img src=\\"/api/uploads/a.png\\"> url(/api/themes/x/ui/f.woff2) src=/api/x/');
    expect(rewrite("see '/api/v1/system/i18n' and /api/v1/health/")).toBe("see '/api/system/i18n' and /api/health/");
  });

  it('leaves an address with a host in front of it alone — another service, or text about one', () => {
    for (const value of [
      'https://api.example.com/api/v1/collections',
      '"ATLANTIS_API_URL": "https://api.example.com/api/v1/"',
      'https://uptime.betterstack.com/api/v2/monitors',
      '/mapi/v1/users',
      '/api/v1beta/models',
      '/api/users',
    ]) expect(rewrite(value)).toBe(value);
  });

  it('follows the configured base path', () => {
    const value = '"/data/v1/collections/pages"';
    expect(value.replace(new RegExp(StoredApiAddressesWithoutVersionMigration.pattern('/data'), 'g'), '$1/data/'))
      .toBe('"/data/collections/pages"');
  });

  it('touches nothing outside Postgres', async () => {
    const calls: unknown[] = [];
    await new StoredApiAddressesWithoutVersionMigration().up({ dialect: 'sqlite', execute: async (q: unknown) => { calls.push(q); } } as any);
    expect(calls).toEqual([]);
  });
});
