import type { IStackReleases } from '@cli/services/stack/interfaces/stack-releases.interface';

/** What the image tag is chosen from. */
export interface IStackImageQuery {
  /** `--tag`, when given. */
  readonly explicit?: string;
  /** The framework worktree's version, or null when the stack runs a release as published. */
  readonly preferred: string | null;
  /** The tag the template was captured on, used only when nothing can be pulled. */
  readonly template: string | null;
  /** The published releases, or null when nothing may be pulled. */
  readonly releases: IStackReleases | null;
}
