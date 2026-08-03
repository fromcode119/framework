import type { LayoutResolutionSource } from '@core/layout/enums/layout-resolution-source.enum';
import type { LayoutResolutionStatus } from '@core/layout/enums/layout-resolution-status.enum';
import type { LayoutTargetKind } from '@core/layout/enums/layout-target-kind.enum';
import type { ILayoutDiagnosticEntry } from '@core/layout/interfaces/layout-diagnostic-entry.interface';

export interface IResolvedLayout {
  diagnostics: ILayoutDiagnosticEntry[];
  source?: LayoutResolutionSource;
  status: LayoutResolutionStatus;
  targetKey: string;
  targetKind: LayoutTargetKind;
  winner?: unknown;
  winnerOwner?: string;
}
