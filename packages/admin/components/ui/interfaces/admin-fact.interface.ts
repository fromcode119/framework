/** One recorded value in an `AdminFactGrid`. */
export interface IAdminFact {
  key: string;
  label: string;
  value: string;
  /** A short amber line UNDER the value — a condition worth seeing, never a stand-in for the value. */
  note?: string;
  /** Takes the whole row: a long address in a one-third column wraps to four ragged lines. */
  wide?: boolean;
}
