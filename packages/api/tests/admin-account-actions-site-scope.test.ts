import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { AuthControllerSso } from '@api/controllers/auth/auth-controller-sso';
import { SystemUserController } from '@api/controllers/system/system-user-controller';

/**
 * Sending a password reset and managing a second factor act on an ACCOUNT, so inside a site they follow
 * the rule the Users screens follow (`TenantUserScope`): only the site's own members exist, and an
 * account shared with another site has its sign-in looked after in platform scope.
 */
const MEMBERS = [2, 5];
const SHARED = [5];
const OUTSIDER = 9;

function inSite(tenantId: string | undefined, { platformAdmin = false } = {}) {
  vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(tenantId as any);
  vi.spyOn(TenantMembershipService.prototype, 'listUserIdsForTenant').mockResolvedValue(MEMBERS);
  vi.spyOn(TenantMembershipService.prototype, 'listSharedUserIds').mockResolvedValue(SHARED);
  vi.spyOn(TenantMembershipService.prototype, 'isPlatformAdminAccount').mockResolvedValue(platformAdmin);
}

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

const db = { findOne: vi.fn(async (_table: unknown, where: any) => ({ id: Number(where.id), email: `user${where.id}@site.test` })), find: vi.fn(async () => []) };

function resetController() {
  const controller: any = Object.create(AuthControllerSso.prototype);
  Object.assign(controller, {
    db,
    manager: { writeLog: vi.fn(async () => undefined) },
    logger: { error: vi.fn() },
    normalizeEmail: (value: unknown) => String(value ?? '').trim().toLowerCase(),
    readUserFirstName: () => '',
    issuePasswordResetToken: vi.fn(async () => ({ token: 't', expiresAt: new Date() })),
    buildPasswordResetUrl: vi.fn(async () => 'https://site.test/reset?token=t'),
    sendPasswordResetEmail: vi.fn(async () => true),
  });
  return controller;
}

const request = (body: Record<string, unknown> = {}, params: Record<string, unknown> = {}) => ({ user: { id: '2', roles: ['admin'] }, body, params, query: {} });

beforeEach(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
afterEach(() => { vi.restoreAllMocks(); TenantMode.reset(); });

describe('admin password reset inside a site', () => {
  it('answers an account outside the site as not found, without its email, and sends nothing', async () => {
    inSite('alpha');
    const controller = resetController();
    const res = response();
    await controller.adminSendPasswordReset(request({ userId: OUTSIDER }), res);
    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('@');
    expect(controller.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it('refuses a member whose account another site shares', async () => {
    inSite('alpha');
    const controller = resetController();
    const res = response();
    await controller.adminSendPasswordReset(request({ userId: 5 }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('identity_managed_by_platform');
    expect(controller.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it('still sends for the site’s own member', async () => {
    inSite('alpha');
    const controller = resetController();
    const res = response();
    await controller.adminSendPasswordReset(request({ userId: 2 }), res);
    expect(res.body).toMatchObject({ success: true, emailSent: true });
  });
});

describe('admin second-factor actions inside a site', () => {
  const twoFactor = {
    getTwoFactorStatus: vi.fn(async (_req: unknown, res: any) => res.json({ enabled: false })),
    setup2FA: vi.fn(), verify2FA: vi.fn(), regenerateRecoveryCodes: vi.fn(), disable2FA: vi.fn(),
  };
  const controller = new SystemUserController({ db, twoFactor } as any);

  it.each(['getTwoFactorStatus', 'setup2FA', 'verify2FA', 'regenerateRecoveryCodes', 'disable2FA'] as const)('%s refuses an account outside the site', async (action) => {
    inSite('alpha');
    const res = response();
    await (controller as any)[action](request({}, { id: String(OUTSIDER) }), res);
    expect(res.statusCode).toBe(404);
    expect((twoFactor as any)[action]).not.toHaveBeenCalled();
  });

  it('still reaches the site’s own member', async () => {
    inSite('alpha');
    const res = response();
    await controller.getTwoFactorStatus(request({}, { id: '2' }) as any, res);
    expect(res.body).toEqual({ enabled: false });
  });
});
