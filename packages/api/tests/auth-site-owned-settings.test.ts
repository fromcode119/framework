import { describe, expect, it, vi } from 'vitest';
import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { AuthControllerPolicy } from '@api/controllers/auth/auth-controller-policy';

/**
 * A site decides its own auth settings.
 *
 * The auth controller read every setting from the PLATFORM row first, so a platform
 * `frontend_auth_enabled = false` answered 404 to password reset on a storefront whose own setting was
 * `true` ("Not found" on the reset page), and reset emails carried the platform's name.
 */
class MetaStub {
  private platformScope = false;
  constructor(private readonly platformRows: Record<string, string>, private readonly siteRows: Record<string, string>) {}

  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
    this.platformScope = true;
    try { return await fn(); } finally { this.platformScope = false; }
  }

  async findOne(_table: string, where: { key: string }): Promise<{ key: string; value: string } | null> {
    const rows = this.platformScope ? this.platformRows : this.siteRows;
    return where.key in rows ? { key: where.key, value: rows[where.key] } : null;
  }
}

class SettingsProbe extends AuthControllerPolicy {
  read(key: string) { return this.getSettingBoolean(key, true); }
  name() { return this.resolveFrameworkAppName(); }
}

const probe = (db: MetaStub) => new SettingsProbe({ db, hooks: { call: vi.fn() } } as any, {} as any);
const onSite = <T>(fn: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId: 'shop' } as any, fn);

describe('auth settings on a site', () => {
  const db = new MetaStub(
    { [SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED]: 'false', [SystemConstants.META_KEY.PLATFORM_NAME]: 'Platform' },
    { [SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED]: 'true', [SystemConstants.META_KEY.PLATFORM_NAME]: 'Shop' },
  );

  it("read the site's own value, not the platform's", async () => {
    expect(await onSite(() => probe(db).read(SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED))).toBe(true);
    expect(await onSite(() => probe(db).name())).toBe('Shop');
  });

  it("fall back to the platform's value where the site has none, and off a site", async () => {
    const platformOnly = new MetaStub({ [SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED]: 'false' }, {});
    expect(await onSite(() => probe(platformOnly).read(SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED))).toBe(false);
    expect(await probe(db).read(SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED)).toBe(false);
  });
});
