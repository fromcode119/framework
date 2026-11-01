import { EntityFieldErrorCode } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FieldDisplayLabel } from '@/lib/collection/field-display-label';

/** A refused save, read for the editor: one message for the save bar and the words under each field. */
export class CollectionEditSubmitError {
  static parse(err: any, collection: any): { message: string; perField: Record<string, string[]> } {
    let message = AdminI18n.t('collection.edit.failed');
    if (err?.data?.errors) {
      if (Array.isArray(err.data.errors)) {
        const items = err.data.errors as any[];
        const said = items.map((e) => CollectionEditSubmitError.text(e, collection));
        message = said.join(', ');
        const perField: Record<string, string[]> = {};
        items.forEach((e, index) => {
          if (e && typeof e === 'object' && e.field) {
            const key = String(e.field);
            if (!perField[key]) perField[key] = [];
            perField[key].push(said[index]);
          }
        });
        return { message, perField: Object.keys(perField).length ? perField : { base: [message] } };
      }
      if (typeof err.data.errors === 'object') {
        const fieldErrors = err.data.errors as Record<string, string[]>;
        return { message: Object.values(fieldErrors).flat().join(', '), perField: fieldErrors };
      }
    }
    message = err?.message || AdminI18n.t('collection.edit.failed');
    return { message, perField: { base: [message] } };
  }

  /**
   * One refusal in the console's language. A refusal the server names by its code is said here, under the
   * label the form shows the field by; any other keeps the server's own words.
   */
  private static text(error: any, collection: any): string {
    if (typeof error === 'string') return error;
    if (error?.code === EntityFieldErrorCode.REQUIRED.value) {
      const field = (collection?.fields || []).find((one: any) => one?.name === error.field);
      return AdminI18n.t('collection.edit.fieldRequired', { label: field ? FieldDisplayLabel.of(field) : String(error.field) });
    }
    if (typeof error?.message === 'string' && error.message) return error.message;
    return error?.field ? String(error.field) : AdminI18n.t('collection.edit.validationError');
  }
}
