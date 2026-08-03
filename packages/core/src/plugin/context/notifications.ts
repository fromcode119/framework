import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { RolesContextProxy } from '@core/plugin/context/roles';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Framework-owned notification dispatch. Generic cross-cutting work — "who are the platform admins"
 * and "send each of them a message" — lives here ONCE so plugins never resolve users/roles or loop
 * over recipients themselves (that would touch system tables and duplicate logic in every plugin).
 * A plugin supplies only the message content; the framework owns recipient resolution and delivery.
 */
export class NotificationsContextProxy {
  /** Persist one in-app inbox row. Framework-internal; best-effort (a missing table never throws). */
  private static async persistInApp(
    manager: IPluginManagerInterface,
    userId: number,
    message: { title: string; body?: string; link?: string },
    source: string,
  ): Promise<boolean> {
    const id = Number(userId);
    const title = String(message?.title ?? '').trim();
    if (!Number.isFinite(id) || id <= 0 || !title) return false;
    try {
      await manager.db.insert(SystemConstants.TABLE.NOTIFICATIONS, {
        user_id: id,
        title,
        body: String(message?.body ?? ''),
        link: String(message?.link ?? ''),
        source,
        read_at: null,
      });
      return true;
    } catch {
      return false;
    }
  }

  static createNotificationsProxy(manager: IPluginManagerInterface, sourceSlug = '') {
    return {
      /** Persist an in-app inbox notification for one user (surfaced by the admin/portal bell). */
      async notifyUser(
        userId: number,
        message: { title: string; body?: string; link?: string },
      ): Promise<{ success: boolean }> {
        const success = await NotificationsContextProxy.persistInApp(manager, userId, message, sourceSlug);
        return { success };
      },

      async notifyAdmins(
        message: { subject: string; html?: string; text?: string },
        options: { extraRecipients?: string[] } = {},
      ): Promise<{ recipients: number; sent: number }> {
        const recipients = new Set<string>();
        const addEmails = (value: unknown) => {
          // Accept a single address or a comma/semicolon-separated list (the CC setting holds several).
          for (const part of String(value ?? '').split(/[,;\s]+/)) {
            const normalized = part.trim().toLowerCase();
            if (normalized) recipients.add(normalized);
          }
        };

        for (const extra of options.extraRecipients || []) addEmails(extra);

        // Framework-wide notification address(es) — admin Settings → General (`notification_email` +
        // `notification_email_cc`). This is the platform's generic "where admin alerts go" setting, so a
        // plugin never needs its own duplicate email setting; notifyAdmins includes it automatically.
        try {
          const notify = await manager.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.NOTIFICATION_EMAIL }).catch(() => null);
          const notifyCc = await manager.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.NOTIFICATION_EMAIL_CC }).catch(() => null);
          addEmails(notify?.value);
          addEmails(notifyCc?.value);
        } catch { /* best-effort */ }

        // Admin-role recipients via the framework's own users/roles join (RAW db; not plugin context.db).
        try {
          const adminEmails = await RolesContextProxy.createRolesProxy(manager).listUserEmailsWithRole('admin');
          for (const adminEmail of (Array.isArray(adminEmails) ? adminEmails : [])) addEmails(adminEmail);
        } catch { /* best-effort — fall through to whatever recipients we already have */ }

        // In-app inbox rows for every admin user (bell badge) — alongside the emails, best-effort.
        try {
          const adminIds = await RolesContextProxy.createRolesProxy(manager).listUserIdsWithRole('admin');
          for (const adminId of (Array.isArray(adminIds) ? adminIds : [])) {
            await NotificationsContextProxy.persistInApp(
              manager,
              Number(adminId),
              { title: message.subject, body: String(message.text ?? '') },
              sourceSlug,
            );
          }
        } catch { /* best-effort */ }

        const list = Array.from(recipients);
        if (!list.length) {
          await manager.writeLog(
            'WARN',
            '[notifications] notifyAdmins: no admin recipients resolved — grant a user the admin role or pass extraRecipients.',
            'core',
          ).catch(() => undefined);
          return { recipients: 0, sent: 0 };
        }

        const email = manager.integrations?.email;
        if (!email || typeof email.send !== 'function') {
          return { recipients: list.length, sent: 0 };
        }

        let sent = 0;
        for (const to of list) {
          try {
            await email.send({ to, subject: message.subject, html: message.html, text: message.text });
            sent += 1;
          } catch { /* best-effort per recipient — one failure never blocks the rest */ }
        }
        return { recipients: list.length, sent };
      },
    };
  }
}
