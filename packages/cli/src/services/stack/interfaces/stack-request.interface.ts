/** What `stack up` was asked for, once the defaults are filled in. */
export interface IStackRequest {
  readonly name: string;
  readonly framework: string;
  /** The checkout a release was read from; set when the stack runs a release as published. */
  readonly checkout?: string;
  readonly plugins: readonly string[];
  /** Theme worktrees to mount, built in place before the stack starts. */
  readonly themes?: readonly string[];
  readonly version: string;
  readonly port: number;
}
