import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';
import type { ContextSecurityProxy } from '@core/plugin/context/utils';
import { RolesContextProxy } from '@core/plugin/context/roles';
import { SystemConstants } from '@core/constants/system.constants';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { PushDelivery } from '@core/push/push-delivery';
import { PushSurface } from '@core/push/enums/push-surface.enum';
import { PersonNotifier } from '@core/notifications/person-notifier';
import { NotificationCategory } from '@core/notifications/enums/notification-category.enum';
import { FrameworkEmailLayout } from '@core/email/framework-email-layout';
import { EmailSuppressionService } from '@core/email/email-suppression-service';
import { EmailCategoryAudience } from '@core/email/enums/email-category-audience.enum';

/**
 * Framework-owned notification dispatch. Generic cross-cutting work — "who are the platform admins"
 * and "send each of them a message" — lives here ONCE so plugins never resolve users/roles or loop
 * over recipients themselves (that would touch system tables and duplicate logic in every plugin).
 * A plugin supplies only the message content; the framework owns recipient resolution and delivery.
 */
export class NotificationsContextProxy {
  /** Sources that are the framework itself: their admin mail gets the default frame; a plugin's own html is left as designed. */
  private static readonly FRAMED_SOURCES = ['core', 'system'];

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

  /**
   * A staff alert: the bell in the console, and a push to every console device the person turned
   * notifications on for. The push is an extra way of reaching them — it never fails the alert.
   */
  private static async alert(
    manager: IPluginManagerInterface,
    userId: number,
    message: { title: string; body?: string; link?: string },
    source: string,
  ): Promise<boolean> {
    const stored = await NotificationsContextProxy.persistInApp(manager, userId, message, source);
    if (stored) {
      await new PushDelivery(manager.db, MetaContextProxy.createMetaProxy(manager))
        .toPerson(Number(userId), message, PushSurface.CONSOLE)
        .catch(() => 0);
    }
    return stored;
  }

  /**
   * Whether `userId` belongs to the site this call is for. `users` is global, so without this a plugin
   * on one site could put a bell entry — with any link — in any account's console on any other site.
   */
  private static async isMemberHere(manager: IPluginManagerInterface, userId: number): Promise<boolean> {
    const tenantId = TenantMode.isEnabled() ? String(RequestContextUtils.getTenantId() ?? '').trim() : '';
    if (!tenantId) return true;
    const row = await manager.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(userId), tenant_id: tenantId }).catch(() => null);
    return !!row && TenantMembership.from(row as Record<string, unknown>).isActive;
  }

  /**
   * Every address `notifyAdmins` mails: the extra addresses, the notification address(es) in Settings →
   * General (`notification_email` + `notification_email_cc`) and every admin-role user. Exposed so a screen
   * can show who an alert reaches without sending one.
   */
  /**
   * The stream an alert is filed under, or `''` when it must reach everyone. Only a DECLARED `admin`
   * stream can be muted, and a `locked` one never is — it is sent unlabelled, so no opt-out, old or new,
   * can reach it. An unknown key is treated as no stream at all rather than silently muting something
   * nobody can see in a profile.
   */
  private static mutableStream(manager: IPluginManagerInterface, key: unknown): string {
    const stream = (manager as any).emailCategories?.get?.(key);
    return stream && stream.audience === EmailCategoryAudience.ADMIN && !stream.locked ? String(stream.key) : '';
  }

  /** Whether this administrator switched the stream off in their profile. The bell follows the email. */
  private static async mutedBy(manager: IPluginManagerInterface, userId: number, stream: string): Promise<boolean> {
    const user = await manager.db.findOne(SystemConstants.TABLE.USERS, { id: userId }).catch(() => null);
    const email = String((user as any)?.email ?? '').trim();
    return email ? EmailSuppressionService.isSuppressed(manager.db, email, stream) : false;
  }

  static async adminRecipients(manager: IPluginManagerInterface, extraRecipients: string[] = []): Promise<string[]> {
    const recipients = new Set<string>();
    const addEmails = (value: unknown) => {
      // Accept a single address or a comma/semicolon-separated list (the CC setting holds several).
      for (const part of String(value ?? '').split(/[,;\s]+/)) {
        const normalized = part.trim().toLowerCase();
        if (normalized) recipients.add(normalized);
      }
    };
    for (const extra of extraRecipients) addEmails(extra);

    // The platform's generic "where admin alerts go" setting, so a plugin never needs its own duplicate.
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
    return Array.from(recipients);
  }

  static createNotificationsProxy(
    manager: IPluginManagerInterface,
    sourceSlug = '',
    security?: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>,
  ) {
    return {
      /** An in-app inbox notification for one user (the console bell), pushed to their console devices too. */
      async notifyUser(
        userId: number,
        message: { title: string; body?: string; link?: string },
      ): Promise<{ success: boolean }> {
        if (!(await NotificationsContextProxy.isMemberHere(manager, Number(userId)))) return { success: false };
        const success = await NotificationsContextProxy.alert(manager, userId, message, sourceSlug);
        return { success };
      },

      async notifyPerson(
        person: { userId?: number; email?: string },
        message: { title: string; body?: string; link?: string; text?: string; category: string },
      ): Promise<{ pushed: number; texted: boolean }> {
        // The category decides whose consent covers the message, so an unknown one sends nothing.
        const category = NotificationCategory.fromValue(String(message?.category ?? '')) as NotificationCategory | undefined;
        if (!category) return { pushed: 0, texted: false };
        const notifier = new PersonNotifier(manager);
        const userId = await notifier.resolve(person ?? {});
        return userId ? notifier.notify({ ...message, userId, category }) : { pushed: 0, texted: false };
      },

      /**
       * Declare an alert this plugin sends to the administrators, so each of them can switch it off in
       * their own profile. Call it in `onInit`; the registry is rebuilt on every boot from what is
       * installed. The plugin owns the words (i18n keys in its own dictionary) and the key it files its
       * `notifyAdmins` calls under — the framework owns the list, the switches and the enforcement.
       *
       * No `email` capability is needed: this only names a stream, it sends nothing.
       */
      registerAdminAlert(alert: { key: string; labelKey: string; descriptionKey: string; locked?: boolean }): void {
        (manager as any).emailCategories?.register({ ...alert, pluginSlug: sourceSlug, audience: EmailCategoryAudience.ADMIN });
      },

      async notifyAdmins(
        message: { subject: string; html?: string; text?: string },
        options: { extraRecipients?: string[]; category?: string } = {},
      ): Promise<{ recipients: number; sent: number }> {
        // Arbitrary addresses make this a way to send the platform's mail to anyone, so they need the
        // same capability as sending mail directly. Admin recipients need nothing extra.
        if ((options.extraRecipients || []).length && security && !security.hasCapability('email')) security.handleViolation('email');
        const list = await NotificationsContextProxy.adminRecipients(manager, options.extraRecipients);
        // The stream this alert belongs to. Mail carrying it is withheld, per address, from anyone who
        // switched it off (the send driver enforces that); the bell is withheld below.
        const stream = NotificationsContextProxy.mutableStream(manager, options.category);

        // In-app inbox rows for every admin user (bell badge) — alongside the emails, best-effort.
        try {
          const adminIds = await RolesContextProxy.createRolesProxy(manager).listUserIdsWithRole('admin');
          for (const adminId of (Array.isArray(adminIds) ? adminIds : [])) {
            if (stream && await NotificationsContextProxy.mutedBy(manager, Number(adminId), stream)) continue;
            await NotificationsContextProxy.alert(
              manager,
              Number(adminId),
              { title: message.subject, body: String(message.text ?? '') },
              sourceSlug,
            );
          }
        } catch { /* best-effort */ }

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

        const html = NotificationsContextProxy.FRAMED_SOURCES.includes(sourceSlug)
          ? await FrameworkEmailLayout.wrap(manager, message).catch(() => message.html)
          : message.html;
        let sent = 0;
        for (const to of list) {
          try {
            await email.send({ to, subject: message.subject, html, text: message.text, ...(stream ? { category: stream } : {}) });
            sent += 1;
          } catch { /* best-effort per recipient — one failure never blocks the rest */ }
        }
        return { recipients: list.length, sent };
      },
    };
  }
}
