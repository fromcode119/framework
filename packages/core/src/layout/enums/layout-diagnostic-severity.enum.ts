import { Enum } from '@fromcode119/reactor';

/** Severity of a layout diagnostic message. */
export class LayoutDiagnosticSeverity extends Enum {
  static readonly ERROR = new LayoutDiagnosticSeverity('error');
  static readonly WARNING = new LayoutDiagnosticSeverity('warning');
  static readonly INFO = new LayoutDiagnosticSeverity('info');

  private constructor(value: string) {
    super(value);
  }
}
