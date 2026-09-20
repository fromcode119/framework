import { Enum } from '@fromcode119/react-class-components';

/** Which of the four detail panels is open. One at a time, or none. */
export class ImportPlanDetailTab extends Enum {
  static readonly RECORDS = new ImportPlanDetailTab('records');
  static readonly EXTENSIONS = new ImportPlanDetailTab('extensions');
  static readonly WARNINGS = new ImportPlanDetailTab('warnings');
  static readonly EXPORT = new ImportPlanDetailTab('export');

  private constructor(value: string) {
    super(value);
  }
}
