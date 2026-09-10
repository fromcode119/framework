/**
 * How a source directory is obtained, so the builder never has to care.
 *
 * A provider produces a directory; the builder turns a directory into a built extension. Neither
 * knows about the other, which is what makes "git or archive or something else in future" a new
 * class rather than a new branch in shared code.
 *
 * Each provider owns its OWN validation. `GitUrlPolicy` and `GitBranchPolicy` are the git
 * provider's rules, not global ones — an archive has entirely different things to be careful about.
 */
export interface ISourceProvider {
  /** Human-readable name of the transport, for build logs and operator-facing errors. */
  readonly kind: string;

  /** Produce a directory containing the extension's source. Throws with a stated reason. */
  resolve(): Promise<string>;
}
