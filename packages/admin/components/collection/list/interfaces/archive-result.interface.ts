/** The archive / restore endpoint's answer: how many records moved, and what the cascade did. */
export interface IArchiveResult {
  success: boolean;
  count: number;
  cascaded: Array<{ collection: string; label: string; count: number; skipped?: string }>;
}
