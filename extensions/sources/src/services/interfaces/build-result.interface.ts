import { BuildSourceType } from '@plugin/src/services/enums/build-source-type.enum';

export interface IBuildResult {
  slug: string;
  type: BuildSourceType;
  success: boolean;
  version?: string;
  fileName?: string;
  error?: string;
}
