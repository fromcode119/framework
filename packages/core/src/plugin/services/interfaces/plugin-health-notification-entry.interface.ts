import type { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

export interface IPluginHealthNotificationEntry {
  /** Absent only for a malformed manifest — the template supplies the fallback wording. */
  slug?: string;
  held: boolean;
  /** Why it's held. Absent → the template words it generically. */
  reason?: PluginHeldReason;
  /** The registration error. Absent → the template words it generically. */
  error?: string;
}
