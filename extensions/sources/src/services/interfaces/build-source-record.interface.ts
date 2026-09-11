import type { IBuildSourceInput } from '@plugin/src/services/interfaces/build-source-input.interface';

export interface IBuildSourceRecord extends IBuildSourceInput {
  id?: number | string;
  fileName?: string;
  gitToken?: string | null;
  lastBuildAt?: string;
  lastBuildStatus?: string;
  lastCommitSha?: string;
  lastError?: string;
  version?: string;
  autoBuild?: boolean;
  autoUpdate?: boolean;
  /** Commit subjects since the previously built revision — the changelog for `version`. */
  changelog?: string;
  [key: string]: unknown;
}
