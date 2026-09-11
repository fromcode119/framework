import { BuildSourceType } from '@sources/services/enums/build-source-type.enum';

/**
 * The API-safe projection of a build source: every field of the record EXCEPT the two secrets
 * (`gitSecret`, `gitToken`), plus two booleans saying whether each is configured. Declared
 * explicitly rather than derived — `Omit<>` is a type-level operator with no class form, and
 * spelling the fields out makes the omission visible instead of implied.
 */
export interface IBuildSourceSummary {
  slug: string;
  type: BuildSourceType;
  gitUrl: string;
  branch: string;
  id?: number | string;
  fileName?: string;
  lastBuildAt?: string;
  lastBuildStatus?: string;
  lastCommitSha?: string;
  lastError?: string;
  version?: string;
  /** Build when the branch moves. Off unless the operator asked for it, per source. */
  autoBuild?: boolean;
  /** Install each successful build. A separate risk from building, so a separate switch. */
  autoUpdate?: boolean;
  /** Commit subjects since the previously built revision, as the changelog for this version. */
  changelog?: string;
  hasGitSecret: boolean;
  usesEnvToken: boolean;
  [key: string]: unknown;
}
