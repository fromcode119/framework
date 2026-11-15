import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What an activity entry says, in the reader's language.
 *
 * An entry is written where it happens, and it was written as an English sentence — "Successful login
 * for ivan@example.com" — so a Bulgarian console listed its own history in English, and the sentence
 * repeated the actor that stands in the column beside it. An entry now names its EVENT in `context`,
 * and the console says that event in its own words; the stored sentence is the fallback, so every row
 * written before this still reads.
 */
export class ActivityMessage {
  static of(row: { message?: string; context?: Record<string, unknown> | null }): string {
    const event = String(row?.context?.event ?? '').trim();
    if (!event) return String(row?.message ?? '');
    const key = `activity.events.${event}`;
    const said = AdminI18n.t(key, (row?.context ?? {}) as Record<string, unknown>);
    return said === key ? String(row?.message ?? '') : said;
  }
}
