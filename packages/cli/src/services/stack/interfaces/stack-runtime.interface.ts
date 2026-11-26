/** The platform a stack was resolved to run. */
export interface IStackRuntime {
  /** The directory the topology is read from, and whose built packages are mounted. */
  readonly framework: string;
  /** The checkout a release was read from; set only when the stack runs a release as published. */
  readonly checkout?: string;
  /** The image tag. */
  readonly version: string;
}
