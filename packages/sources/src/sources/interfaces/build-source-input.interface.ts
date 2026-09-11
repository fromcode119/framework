import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

export interface IBuildSourceInput {
  /** Which provider fetches this source. Defaults to git for rows that predate the field. */
  provider?: string;
  slug: string;
  type: BuildSourceType;
  gitUrl: string;
  branch: string;
  gitSecret?: string;
  autoBuild?: boolean;
  /**
   * Replace an extension that is ALREADY installed with a newer build.
   *
   * A separate risk from installing one that is not there, so a separate switch: this is what
   * allows code currently serving a site to be swapped out.
   */
  autoUpdate?: boolean;
  /** Put each successful build in place when the extension is not installed yet. Defaults to on. */
  installAfterBuild?: boolean;
}
