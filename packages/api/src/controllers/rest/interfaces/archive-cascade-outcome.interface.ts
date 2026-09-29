/** What an archive or restore did to one follower collection. */
export interface IArchiveCascadeOutcome {
  collection: string;
  label: string;
  count: number;
  /** Set when this follower was left alone: an {@link ArchiveCascadeSkip} value. */
  skipped?: string;
}
