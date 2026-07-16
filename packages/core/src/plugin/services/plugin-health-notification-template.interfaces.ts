import type { PluginHeldReason } from './plugin-health.enums';

export interface PluginHealthNotificationEntry {
  /** Absent only for a malformed manifest — the template supplies the fallback wording. */
  slug?: string;
  held: boolean;
  /** Why it's held. Absent → the template words it generically. */
  reason?: PluginHeldReason;
  /** The registration error. Absent → the template words it generically. */
  error?: string;
}

export interface PluginHealthNotificationData {
  count: number;
  plugins: PluginHealthNotificationEntry[];
}
