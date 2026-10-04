export interface IPermalinkComputed {
  baseUrl: string;
  finalPrefix: string;
  fullDisplayPrefix: string;
  /** What the preview shows: the path, or "…" before the record has one. Never saved. */
  displayValue: string;
  /** The path itself; '' before the record has a slug. The only value the control writes. */
  pathValue: string;
  suffix: string;
  isCustomMode: boolean;
  isAbsoluteOverride: boolean;
}
