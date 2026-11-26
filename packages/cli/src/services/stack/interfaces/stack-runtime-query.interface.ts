/** What `stack up` was told about the platform to run. */
export interface IStackRuntimeQuery {
  /** `--framework`, when given. */
  readonly framework?: string;
  /** Where the command runs. */
  readonly directory: string;
  /** `--tag`, when given. */
  readonly tag?: string;
  /** `--from`, when given. */
  readonly template?: string;
  /** False under `--no-pull`. */
  readonly pull: boolean;
}
