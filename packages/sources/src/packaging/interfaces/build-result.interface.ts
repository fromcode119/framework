import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

export interface IBuildResult {
  slug: string;
  type: BuildSourceType;
  success: boolean;
  version?: string;
  fileName?: string;
  error?: string;
  /** What changed in this version, for the admin to show before an operator updates. */
  changelog?: string;
}
