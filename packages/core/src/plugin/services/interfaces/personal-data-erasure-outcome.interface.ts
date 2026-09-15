import type { IPersonalDataErasure } from '@core/plugin/services/interfaces/personal-data-erasure.interface';

/**
 * What one dataset did AND why that was the strategy — the two halves an evidence record needs.
 *
 * Reported together because they are only meaningful together: "retained 32 invoices" is an answer
 * an operator can act on only alongside who decided to retain them and on what stated basis.
 */
export interface IPersonalDataErasureOutcome extends IPersonalDataErasure {
  label: string;
  /** What this dataset holds, so a report says what was reached without a second lookup. */
  fields: string[];
  reason: string;
  /** Which layer decided — a {@link PersonalDataPolicyLayer} value, as its plain string. */
  source: string;
  provenance: string;
  problem: string;
  /** Set when the source could not run at all, which is not the same as having nothing to erase. */
  error?: string;
}
