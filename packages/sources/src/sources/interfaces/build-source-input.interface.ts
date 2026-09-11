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
  autoUpdate?: boolean;
}
