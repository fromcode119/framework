
import { IResolutionScanContext } from '@api/services/helpers/interfaces/resolution-scan-context.interface';

export interface IResolutionStructureScanContext extends IResolutionScanContext {
  pathSegments: string[];
  structureSegments: string[];
}
