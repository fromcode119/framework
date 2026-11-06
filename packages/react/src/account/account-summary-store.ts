import type { IAccountSummaries } from '@react/account/interfaces/account-summaries.interface';
import type { IAccountSectionSummary } from '@react/account/interfaces/account-section-summary.interface';

/**
 * The one copy of the account summaries for the page, shared by the menu, the person block and the
 * overview tiles so each section's count is fetched once, not once per place it appears. Loaded by
 * {@link AccountSummaryLoader}; read by anyone through `subscribe`.
 */
export class AccountSummaryStore {
  private static current: IAccountSummaries = {};
  private static readonly listeners = new Set<() => void>();

  static get(): IAccountSummaries {
    return AccountSummaryStore.current;
  }

  static section(key: string): IAccountSectionSummary | undefined {
    return AccountSummaryStore.current.sections?.[key];
  }

  static subscribe(listener: () => void): () => void {
    AccountSummaryStore.listeners.add(listener);
    return () => { AccountSummaryStore.listeners.delete(listener); };
  }

  /** Merge the answers in order; a later contributor adds to a section, it never erases one. */
  static set(parts: IAccountSummaries[]): void {
    const merged: IAccountSummaries = { sections: {} };
    for (const part of parts) {
      if (!part) continue;
      if (part.who && !merged.who) merged.who = part.who;
      for (const [key, summary] of Object.entries(part.sections || {})) {
        merged.sections![key] = { ...merged.sections![key], ...summary };
      }
    }
    AccountSummaryStore.current = merged;
    AccountSummaryStore.listeners.forEach((listener) => listener());
  }
}
