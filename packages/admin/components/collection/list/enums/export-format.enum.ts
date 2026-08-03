import { Enum } from '@fromcode119/reactor';

/** Bulk-export file format. Sent to the API as its `.value`. */
export class ExportFormat extends Enum {
  static readonly JSON = new ExportFormat('json');
  static readonly CSV = new ExportFormat('csv');

  private constructor(value: string) {
    super(value);
  }
}
