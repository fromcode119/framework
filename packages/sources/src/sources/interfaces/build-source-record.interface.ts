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
  /** The vendor the last built manifest declared; empty before its first build. */
  namespace?: string;
  autoBuild?: boolean;
  autoUpdate?: boolean;
  installAfterBuild?: boolean;
  /** The site each successful build is published to; '' when publishing is off. */
  publishToSite?: string;
  /** The outcome of the last hand-over to that site, as shown on the Sources screen. */
  lastPublish?: string;
  /** Commit subjects since the previously built revision — the changelog for `version`. */
  changelog?: string;
  [key: string]: unknown;
}
