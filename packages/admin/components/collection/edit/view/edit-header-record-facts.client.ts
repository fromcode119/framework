import { ReadOnlyFieldValue } from '@/components/collection/view/read-only-field-value.client';

/**
 * The few facts that say where a record stands, for the line under its title.
 *
 * They are the fields the collection already chose to show beside each record in its list
 * (`admin.list.meta`) — an order's customer, whether it is paid, whether it has shipped. The edit page
 * used to print only the list's name and the record's number there, so the state of the record was
 * somewhere down the form, or in a column that sits under it on a narrow screen.
 */
export class EditHeaderRecordFacts {
  static of(collection: any, formData: Record<string, unknown> | null | undefined): string[] {
    const names: string[] = Array.isArray(collection?.admin?.list?.meta) ? collection.admin.list.meta : [];
    return names
      .map((name) => {
        const field = (collection?.fields || []).find((candidate: any) => candidate?.name === name);
        return field ? ReadOnlyFieldValue.describe(field, formData?.[name]).trim() : '';
      })
      .filter(Boolean);
  }
}
