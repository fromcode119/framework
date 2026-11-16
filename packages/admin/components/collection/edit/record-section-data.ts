import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';

/** What a section's recorded data is, read before it is drawn: how many rows, and whether it is one table. */
export class RecordSectionData {
  /**
   * The one field of the section whose value reads as a table. A section with one table is drawn as
   * that table — it carries the search, the filters and the paging the console gives every list — so a
   * section holding two of them, or none, is left as plain rows instead.
   */
  static tableField(fields: any[], formData: Record<string, any> | undefined): string | undefined {
    const tables = fields.filter((field) => RecordSectionFields.readsAsData(field)
      && StructuredReadOnlyFieldService.classify(StructuredReadOnlyFieldService.parse(formData?.[field.name])).kind
        === StructuredNodeKind.ARRAY_TABLE);
    return tables.length === 1 ? tables[0].name : undefined;
  }

  /** How many rows the section's own data holds — what decides whether a search is worth offering. */
  static rowCount(fields: any[], formData: Record<string, any> | undefined): number {
    return fields
      .filter((field: any) => RecordSectionFields.readsAsData(field))
      .map((field: any) => formData?.[field.name])
      .filter((value: unknown) => Array.isArray(value))
      .reduce((most: number, value: any) => Math.max(most, value.length), 0);
  }
}
