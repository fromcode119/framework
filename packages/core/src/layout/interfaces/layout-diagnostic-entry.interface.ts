import type { LayoutDiagnosticCode } from '@core/layout/enums/layout-diagnostic-code.enum';
import type { LayoutDiagnosticSeverity } from '@core/layout/enums/layout-diagnostic-severity.enum';

export interface ILayoutDiagnosticEntry {
  code: LayoutDiagnosticCode;
  message: string;
  severity: LayoutDiagnosticSeverity;
  targetKey: string;
}
