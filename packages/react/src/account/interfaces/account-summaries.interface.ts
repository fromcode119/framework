import type { IAccountSectionSummary } from '@react/account/interfaces/account-section-summary.interface';

/**
 * What a stat contributor's optional `loadSummaries(context)` returns: per-section summaries keyed by
 * section key, and `who`, one line under the person's name at the head of the menu (a plugin that
 * knows when someone first bought says so; the framework has no such date of its own).
 */
export interface IAccountSummaries {
  who?: string;
  sections?: Record<string, IAccountSectionSummary>;
}
