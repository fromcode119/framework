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
  constructor(
    private readonly platformRows: Record<string, string>,
    private readonly siteRows: Record<string, string>,
    private readonly otherSiteRows: Record<string, string> = {},
  ) {}

  /** Under the platform marker the real table shows every partition: other sites' rows come back too. */
  async find(_table: string, options: { where: { key: string } }): Promise<Array<{ key: string; value: string; tenant_id: string | null }>> {
    const key = options.where.key;
    if (!this.platformScope) return key in this.siteRows ? [{ key, value: this.siteRows[key], tenant_id: 'shop' }] : [];
    return [
      ...(key in this.otherSiteRows ? [{ key, value: this.otherSiteRows[key], tenant_id: 'other' }] : []),
      ...(key in this.platformRows ? [{ key, value: this.platformRows[key], tenant_id: null }] : []),
    ];
  }

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

  it("never answers with another site's row off a site — the console host named itself after a site", async () => {
    const crowded = new MetaStub({ [SystemConstants.META_KEY.PLATFORM_NAME]: 'Platform' }, {}, { [SystemConstants.META_KEY.PLATFORM_NAME]: 'Other site' });
    expect(await probe(crowded).name()).toBe('Platform');
  });
});
