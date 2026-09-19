import { Enum } from '@fromcode119/react-class-components';

/** Which group a plan row is rendered under, and so what the row may say about it. */
export class ImportPlanRowKind extends Enum {
  static readonly SKIPPED = new ImportPlanRowKind('skipped');
  static readonly REMAPPED = new ImportPlanRowKind('remapped');
  static readonly KEPT = new ImportPlanRowKind('kept');

  private constructor(value: string) {
    super(value);
  }
}
