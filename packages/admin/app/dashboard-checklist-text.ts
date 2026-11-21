import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A setup or configuration row in the console's language.
 *
 * The server sends each row's words as a dictionary key with its values (`text.title`, `text.detail`,
 * `text.action`) beside the English it always sent. It used to send only the English, so a console
 * set to any other language showed these rows in English. A part with no key — a time zone, a list of
 * languages — is a value, sent as `literal`, and shown as it is.
 */
export class DashboardChecklistText {
  static title(item: Record<string, unknown>): string {
    return DashboardChecklistText.part(item, 'title', item.title);
  }

  static detail(item: Record<string, unknown>): string {
    return DashboardChecklistText.part(item, 'detail', item.detail);
  }

  static action(item: Record<string, unknown>): string {
    return DashboardChecklistText.part(item, 'action', item.actionLabel);
  }

  private static part(item: Record<string, unknown>, name: string, english: unknown): string {
    const text = (item.text ?? {}) as Record<string, { key?: string; vars?: Record<string, unknown>; literal?: string } | undefined>;
    const part = text[name];
    if (part?.key) return AdminI18n.t(part.key, part.vars ?? {});
    if (part && 'literal' in part) return String(part.literal ?? '');
    return english === undefined || english === null ? '' : String(english);
  }
}
