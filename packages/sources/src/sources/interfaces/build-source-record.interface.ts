import type { IBuildSourceInput } from '@sources/sources/interfaces/build-source-input.interface';

export interface IBuildSourceRecord extends IBuildSourceInput {
  id?: number | string;
  /** Which provider fetches this source. See SourceProviders — the only file that names one. */
  provider?: string;
  fileName?: string;
  gitToken?: string | null;
  lastBuildAt?: string;
  lastBuildStatus?: string;
  lastCommitSha?: string;
  lastError?: string;
  version?: string;
  autoBuild?: boolean;
  autoUpdate?: boolean;
  installAfterBuild?: boolean;
  /** Commit subjects since the previously built revision — the changelog for `version`. */
  changelog?: string;
  [key: string]: unknown;
}
