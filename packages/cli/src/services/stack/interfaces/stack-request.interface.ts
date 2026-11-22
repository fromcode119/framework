/** What `stack up` was asked for, once the defaults are filled in. */
export interface IStackRequest {
  readonly name: string;
  readonly framework: string;
  readonly plugins: readonly string[];
  /** Theme worktrees to mount, built in place before the stack starts. */
  readonly themes?: readonly string[];
  readonly version: string;
  readonly port: number;
}
