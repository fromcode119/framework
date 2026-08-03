
import type { IResolutionScanEntry } from '@api/services/helpers/interfaces/resolution-scan-entry.interface';
import type { IResolutionScanOptions } from '@api/services/helpers/interfaces/resolution-scan-options.interface';

export interface IResolutionScanContext {
  entries: IResolutionScanEntry[];
  options: IResolutionScanOptions;
  withLocale: (q: any) => any;
}
