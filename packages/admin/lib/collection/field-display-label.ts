import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

/** The label a field is shown under in the console — its own control, and any message about it. */
export class FieldDisplayLabel {
  static of(field: Pick<ICollectionField, 'name' | 'label' | 'extendedBy'>): string {
    // A field the framework adds itself reads in the console's language, from its own dictionary.
    const own = field.extendedBy === 'system' ? AdminI18n.optional(`collection.systemFields.${field.name}.label`) : '';
    return own || field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim();
  }
}
