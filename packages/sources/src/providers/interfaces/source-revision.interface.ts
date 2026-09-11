/** What a provider put on disk, and which revision it is. */
export interface ISourceRevision {
  /** Where the source now lives, ready to build. */
  directory: string;
  /** The revision identifier this provider uses — a commit sha for git. Null when it has none. */
  revision: string | null;
}
