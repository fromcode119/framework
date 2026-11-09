import { describe, expect, it, vi } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { EmailCategoryAudience } from '@core/email/enums/email-category-audience.enum';
import { EmailCategoryRegistry } from '@core/email/email-category-registry';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';

/**
 * An administrator can switch an alert off in their own profile. The framework then withholds both the
 * email and the bell from them — and only from them: the others, and the platform's notification
 * address, still get it. An alert no one declared, or one declared `locked`, can never be muted.
 */
function setup(muted: Record<string, string[]>) {
  const users = [
    { id: 1, email: 'owner@site.test', roles: ['admin'] },
    { id: 2, email: 'ops@site.test', roles: ['admin'] },
  ];
  const sent: Array<{ to: string; category?: string }> = [];
  const inbox: number[] = [];
  const registry = new EmailCategoryRegistry();
  registry.register({ key: 'admin-low-stock', labelKey: 'a', descriptionKey: 'b', pluginSlug: 'shop', audience: EmailCategoryAudience.ADMIN });
  registry.register({ key: 'admin-certificate-expiry', labelKey: 'a', descriptionKey: 'b', pluginSlug: 'core', audience: EmailCategoryAudience.ADMIN, locked: true });
  registry.register({ key: 'review-invitation', labelKey: 'a', descriptionKey: 'b', pluginSlug: 'sp' });

  const db = {
    find: vi.fn(async (table: string, query: any) => {
      if (table === SystemConstants.TABLE.USERS_ROLES) return users.map((u) => ({ user_id: u.id }));
      if (table === SystemConstants.TABLE.USERS) return users;
      if (table === SystemConstants.TABLE.EMAIL_SUPPRESSIONS) {
        const address = query?.where?.address;
        return (muted[address] ?? []).map((category) => ({ address, category }));
      }
      return [];
    }),
    findOne: vi.fn(async (table: string, where: any) => (table === SystemConstants.TABLE.USERS ? users.find((u) => u.id === where.id) ?? null : null)),
    insert: vi.fn(async (table: string, row: any) => { if (table === SystemConstants.TABLE.NOTIFICATIONS) inbox.push(row.user_id); return row; }),
  };
  const manager = {
    db,
    emailCategories: registry,
    integrations: { email: { send: vi.fn(async (m: any) => { sent.push({ to: m.to, category: m.category }); }) } },
    writeLog: vi.fn(async () => undefined),
  } as any;
  return { notifications: NotificationsContextProxy.createNotificationsProxy(manager, 'shop'), sent, inbox };
}

describe('notifyAdmins category', () => {
  it('files the mail under the stream so the send layer can withhold it per address', async () => {
    const { notifications, sent } = setup({});
    await notifications.notifyAdmins({ subject: 'Low stock' }, { category: 'admin-low-stock' });
    expect(sent.map((m) => m.category)).toEqual(['admin-low-stock', 'admin-low-stock']);
  });

  it('withholds the bell from an administrator who muted it, and only from them', async () => {
    const { notifications, inbox } = setup({ 'owner@site.test': ['admin-low-stock'] });
    await notifications.notifyAdmins({ subject: 'Low stock' }, { category: 'admin-low-stock' });
    expect(inbox).toEqual([2]);
  });

  it('honours a global opt-out as well', async () => {
    const { notifications, inbox } = setup({ 'ops@site.test': ['all'] });
    await notifications.notifyAdmins({ subject: 'Low stock' }, { category: 'admin-low-stock' });
    expect(inbox).toEqual([1]);
  });

  it('sends a locked alert unlabelled, so no opt-out can reach it', async () => {
    const { notifications, sent, inbox } = setup({ 'owner@site.test': ['admin-certificate-expiry'] });
    await notifications.notifyAdmins({ subject: 'Certificate' }, { category: 'admin-certificate-expiry' });
    expect(sent.every((m) => m.category === undefined)).toBe(true);
    expect(inbox).toEqual([1, 2]);
  });

  it('treats an unknown or person stream as no stream at all', async () => {
    const { notifications, sent, inbox } = setup({ 'owner@site.test': ['review-invitation', 'typo'] });
    await notifications.notifyAdmins({ subject: 'A' }, { category: 'typo' });
    await notifications.notifyAdmins({ subject: 'B' }, { category: 'review-invitation' });
    expect(sent.every((m) => m.category === undefined)).toBe(true);
    expect(inbox).toEqual([1, 2, 1, 2]);
  });

  it('reaches everyone when no category is given', async () => {
    const { notifications, inbox } = setup({ 'owner@site.test': ['admin-low-stock'] });
    await notifications.notifyAdmins({ subject: 'Hi' });
    expect(inbox).toEqual([1, 2]);
  });
});
