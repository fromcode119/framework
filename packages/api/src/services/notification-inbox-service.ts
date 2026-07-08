import { SystemConstants } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';

/**
 * Per-user in-app notification inbox reads/writes (`_system_notifications`). Rows are written by the
 * framework notifications context (notifyAdmins fan-out / notifyUser); this service only serves the
 * bell UI: list newest-first with an unread count, and mark one/all read — always scoped to the
 * authenticated user, so nobody can read or mutate another user's inbox.
 *
 * NOTE: the raw where-builder compiles `key: null` to `= NULL` (matches nothing in SQL), so unread
 * filtering is done in JS over a bounded per-user window instead of a `read_at: null` where.
 */
export class NotificationInboxService {
  private static readonly LIST_LIMIT = 30;
  /** Bounded per-user window scanned for unread state (an inbox, not an archive). */
  private static readonly SCAN_LIMIT = 300;

  constructor(private readonly db: IDatabaseManager) {}

  private async rowsFor(userId: number): Promise<any[]> {
    return (await this.db.find(SystemConstants.TABLE.NOTIFICATIONS, {
      where: { user_id: userId },
      orderBy: { id: 'desc' },
      limit: NotificationInboxService.SCAN_LIMIT,
    })) || [];
  }

  async list(userId: number): Promise<{ unread: number; notifications: any[] }> {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return { unread: 0, notifications: [] };
    const rows = await this.rowsFor(id);
    const unread = rows.filter((r: any) => !r.read_at).length;
    return {
      unread,
      notifications: rows.slice(0, NotificationInboxService.LIST_LIMIT).map((r: any) => ({
        id: r.id,
        title: String(r.title || ''),
        body: String(r.body || ''),
        link: String(r.link || ''),
        source: String(r.source || ''),
        read: Boolean(r.read_at),
        createdAt: String(r.created_at || ''),
      })),
    };
  }

  async markRead(userId: number, notificationId: number): Promise<{ success: boolean }> {
    const id = Number(notificationId);
    const uid = Number(userId);
    if (!Number.isFinite(id) || !Number.isFinite(uid) || uid <= 0) return { success: false };
    await this.db.update(
      SystemConstants.TABLE.NOTIFICATIONS,
      { id, user_id: uid },
      { read_at: new Date().toISOString() },
    );
    return { success: true };
  }

  async markAllRead(userId: number): Promise<{ success: boolean }> {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) return { success: false };
    const now = new Date().toISOString();
    const rows = await this.rowsFor(uid);
    for (const row of rows) {
      if (!row.read_at) {
        await this.db.update(SystemConstants.TABLE.NOTIFICATIONS, { id: row.id, user_id: uid }, { read_at: now });
      }
    }
    return { success: true };
  }
}
