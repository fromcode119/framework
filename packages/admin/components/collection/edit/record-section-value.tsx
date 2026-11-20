import type { ReactNode } from 'react';
import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';
import { RecordSectionChips } from '@/components/collection/edit/record-section-chips';
import { RecordCellRenderers } from '@/components/collection/list/record-cell-renderers';
import { FieldRendererUtils } from '@/components/collection/field-renderer-utils';
import { FieldDisplayLabel } from '@/lib/collection/field-display-label';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** How one value of a saved record reads in its section's card: words, chips or the list's own cell. */
export class RecordSectionValue {
  static of(field: any, formData: Record<string, any> | undefined): ReactNode {
    const raw = formData?.[field.name];
    if (RecordSectionFields.isMissing(field, raw)) {
      return <span className={AdminClass.of('record-card__missing')}>{AdminI18n.t('collection.edit.notFilledIn')}</span>;
    }
    const kind = String(field?.type || '');
    // A field that DECLARES its values reads by their labels, whatever its type: a computed `text`
    // holding "shown" printed that word beside a select whose same three values read as sentences.
    if (['text', 'textarea', 'email', 'url', 'slug', 'code'].includes(kind) && !field?.admin?.cell && !Array.isArray(field?.options)) {
      return FieldRendererUtils.resolveRenderableText(raw);
    }
    if (kind === 'richText') {
      return FieldRendererUtils.resolveRenderableText(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // Never a relationship: its value is a list of ids, and "Categories 5 55 75" is not a value
    // anyone can read. The renderer below resolves the related records' names.
    const chips = kind === 'relationship' ? null : RecordSectionChips.of(raw);
    if (chips) {
      return (
        <span className={AdminClass.of('chips')}>
          {chips.map((chip, at) => <span key={`${chip}-${at}`} className={AdminClass.of('chip')}>{chip}</span>)}
        </span>
      );
    }
    return RecordCellRenderers.renderCellValue({ columnName: field.name, field, header: FieldDisplayLabel.of(field), raw, row: formData });
  }
}
