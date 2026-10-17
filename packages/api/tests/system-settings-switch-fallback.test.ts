import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { SystemSettingsController } from '@api/controllers/system/system-settings-controller';

/**
 * A site with no row of its own for an on/off setting is acting on the platform's row, so that is what
 * its settings form must show — a missing switch read as OFF, and Save wrote the OFF.
 */
describe('site settings read', () => {
  const META = SystemConstants.META_KEY;
  afterEach(() => vi.restoreAllMocks());

  const read = async (tenantId: string | undefined, siteRows: any[], platformRows: any[]) => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(tenantId as any);
    const db: any = {
      find: vi.fn(async () => siteRows),
      withPlatformAdmin: vi.fn(async (fn: () => unknown) => fn()),
      findOne: vi.fn(async (_table: string, where: { key: string }) => platformRows.find((row) => row.key === where.key) ?? null),
    };
    const controller = new SystemSettingsController({ db } as any);
    let body: any;
    await controller.getSettings({} as any, { json: (value: unknown) => { body = value; }, status: () => ({ json: () => undefined }) } as any);
    return { body, db };
  };

  it('shows the platform value of a switch the site never set', async () => {
    const { body } = await read('t2', [{ key: META.FRONTEND_AUTH_ENABLED, value: 'true', tenant_id: 't2' }],
      [{ key: META.APP_REGISTRATION_ENABLED, value: 'true', tenant_id: null }]);
    expect(body[META.APP_REGISTRATION_ENABLED]).toBe('true');
  });

  it("keeps the site's own value over the platform's", async () => {
    const { body } = await read('t2', [{ key: META.APP_REGISTRATION_ENABLED, value: 'false', tenant_id: 't2' }],
      [{ key: META.APP_REGISTRATION_ENABLED, value: 'true', tenant_id: null }]);
    expect(body[META.APP_REGISTRATION_ENABLED]).toBe('false');
  });

  it('adds nothing outside a site', async () => {
    const { db } = await read(undefined, [], []);
    expect(db.withPlatformAdmin).not.toHaveBeenCalled();
  });
});
