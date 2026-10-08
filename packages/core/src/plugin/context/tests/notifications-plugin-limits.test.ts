import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';

/**
 * `notifyAdmins` sent plugin-supplied mail through the platform's mailer to any `extraRecipients`,
 * with no `email` capability; `notifyUser` put a bell entry, with any link, in any account's console on
 * any site. Arbitrary recipients now need `email`, and `notifyUser` reaches only this site's members.
 */
function setup(options: { granted?: boolean; memberships?: any[] } = {}) {
  const sent: string[] = [];
  const inbox: number[] = [];
  const db = {
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        return (options.memberships ?? []).find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
      }
      return null;
    }),
    find: vi.fn(async () => []),
    insert: vi.fn(async (table: string, row: any) => { if (table === SystemConstants.TABLE.NOTIFICATIONS) inbox.push(row.user_id); return row; }),
  };
  const manager = {
    db,
    integrations: { email: { send: vi.fn(async (m: any) => { sent.push(m.to); }) } },
    writeLog: vi.fn(async () => undefined),
  } as any;
  const security = {
    hasCapability: vi.fn(() => options.granted ?? true),
    handleViolation: vi.fn((cap: string) => { throw new Error(`Missing "${cap}"`); }),
    handleRateLimit: vi.fn(),
  };
  return { notifications: NotificationsContextProxy.createNotificationsProxy(manager, 'shop', security as any), sent, inbox, security };
}

afterEach(() => TenantMode.reset());

describe('notifyAdmins extraRecipients', () => {
  it('needs the email capability, and sends nothing without it', async () => {
    const { notifications, sent } = setup({ granted: false });

    await expect(notifications.notifyAdmins({ subject: 'Hi', html: '<p>x</p>' }, { extraRecipients: ['victim@example.com'] })).rejects.toThrow(/"email"/);
    expect(sent).toEqual([]);
  });

  it('sends to extra recipients when the plugin declared email', async () => {
    const { notifications, sent } = setup();

    await notifications.notifyAdmins({ subject: 'Hi', html: '<p>x</p>' }, { extraRecipients: ['ops@site.test'] });

    expect(sent).toContain('ops@site.test');
  });

  it('needs nothing extra to reach the admins themselves', async () => {
    const { notifications, security } = setup({ granted: false });

    await notifications.notifyAdmins({ subject: 'Hi' });

    expect(security.handleViolation).not.toHaveBeenCalled();
  });
});

describe('notifyUser', () => {
  const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
  const inSite = <T>(fn: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId: 'my-site' } as any, fn);

  it('reaches a member of this site', async () => {
    multiTenant();
    const { notifications, inbox } = setup({ memberships: [{ user_id: '5', tenant_id: 'my-site', roles: ['customer'], state: 'active' }] });

    await expect(inSite(() => notifications.notifyUser(5, { title: 'Hi' }))).resolves.toEqual({ success: true });
    expect(inbox).toEqual([5]);
  });

  it('does not reach an account that belongs to another site', async () => {
    multiTenant();
    const { notifications, inbox } = setup({ memberships: [{ user_id: '9', tenant_id: 'other-site', roles: ['admin'], state: 'active' }] });

    await expect(inSite(() => notifications.notifyUser(9, { title: 'Click', link: 'https://evil.test' }))).resolves.toEqual({ success: false });
    expect(inbox).toEqual([]);
  });
});
