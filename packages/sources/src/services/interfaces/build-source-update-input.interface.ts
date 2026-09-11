import { BuildSourceType } from '@sources/services/enums/build-source-type.enum';

export interface IBuildSourceUpdateInput {
  branch?: string;
  gitSecret?: string;
  gitUrl?: string;
  type?: BuildSourceType;
  autoBuild?: boolean;
  autoUpdate?: boolean;
}
