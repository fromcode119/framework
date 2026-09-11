import { BuildSourceType } from '@plugin/src/services/enums/build-source-type.enum';

export interface IBuildSourceInput {
  slug: string;
  type: BuildSourceType;
  gitUrl: string;
  branch: string;
  gitSecret?: string;
  autoBuild?: boolean;
  autoUpdate?: boolean;
}
