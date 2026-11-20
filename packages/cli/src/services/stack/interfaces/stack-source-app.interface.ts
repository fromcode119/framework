/** One Next app run from source: the dev command, its environment and its source mounts. */
export interface IStackSourceApp {
  readonly command: readonly string[];
  readonly environment: readonly string[];
  readonly volumes: readonly string[];
  /** The dev server's memory limit: the deploy topology caps the app far below what a compile needs. */
  readonly memory: string | null;
}
