/**
 * The `context.notifications` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextNotifications {
  /**
   * Email every platform admin (all users holding the `admin` role) plus any `extraRecipients`,
   * deduped/lowercased. Best-effort: never throws; returns how many recipients were resolved and
   * how many sends succeeded. Pass a ready-built `message` (subject + html/text) — the plugin owns
   * the copy/templates, the framework owns who-gets-it and the sending.
   */
  notifyAdmins(
    message: { subject: string; html?: string; text?: string },
    options?: { extraRecipients?: string[] },
  ): Promise<{ recipients: number; sent: number }>;
  /**
   * Persist an in-app inbox notification for ONE user (framework `_system_notifications`; surfaced by
   * the admin/portal bell). Best-effort: never throws. The plugin supplies content + an optional
   * in-admin link; the framework owns storage and read-state.
   */
  notifyUser(
    userId: number,
    message: { title: string; body?: string; link?: string },
  ): Promise<{ success: boolean }>;
}
