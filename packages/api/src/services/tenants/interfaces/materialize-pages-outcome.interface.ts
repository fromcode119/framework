export interface IMaterializePagesOutcome {
  pages: number;
  themeSeeded: boolean;
  /** Why the theme seed did not run; `null` when it did. */
  themeSeedReason: string | null;
  warnings: string[];
}
