import { describe, expect, it } from 'vitest';
import { RequestContextUtils } from '@fromcode119/core';
import { PublicFrontendSettingsService } from '@api/services/public-frontend-settings-service';

/**
 * The storefront reads these to decide whether to serve the sign-up and password pages. A site that
 * never set `frontend_auth_enabled` inherits the platform's value in the api, and must here too —
 * otherwise the storefront assumed "on" and served pages the api then answered "Not found".
 */
class Db {
  private platformScope = false;
  constructor(private readonly site: Array<{ key: string; value: string }>, private readonly platform: Array<{ key: string; value: string }>) {}
  async find() { return this.platformScope ? this.platform : this.site; }
  async findOne(_table: string, where: { key: string }) { return (this.platformScope ? this.platform : this.site).find((row) => row.key === where.key) ?? null; }
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { this.platformScope = true; try { return await fn(); } finally { this.platformScope = false; } }
}

const inSite = <T>(work: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId: 'fromcode' } as never, work);

describe('public frontend settings', () => {
  it('a site that set nothing inherits the platform value', async () => {
    const db = new Db([], [{ key: 'frontend_auth_enabled', value: 'false' }, { key: 'unrelated', value: 'x' }]);
    expect(await inSite(() => new PublicFrontendSettingsService().getSettings(db as never))).toEqual({ frontend_auth_enabled: 'false' });
  });

  it("the site's own value wins over the platform's", async () => {
    const db = new Db([{ key: 'frontend_auth_enabled', value: 'true' }], [{ key: 'frontend_auth_enabled', value: 'false' }]);
    expect(await inSite(() => new PublicFrontendSettingsService().getSettings(db as never))).toEqual({ frontend_auth_enabled: 'true' });
  });

  it('platform scope reads its own rows only', async () => {
    const db = new Db([{ key: 'frontend_registration_enabled', value: 'false' }], [{ key: 'frontend_auth_enabled', value: 'false' }]);
    expect(await new PublicFrontendSettingsService().getSettings(db as never)).toEqual({ frontend_registration_enabled: 'false' });
  });
});
