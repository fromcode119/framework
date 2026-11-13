import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';
import { RecordCellRenderers } from '@/components/collection/list/record-cell-renderers';
import { FieldRendererUtils } from '@/components/collection/field-renderer-utils';
import { FieldDisplayLabel } from '@/lib/collection/field-display-label';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One section of a SAVED record: a card that reads, and a sheet that edits.
 *
 * The card lists the section's values that are set (and any required one that is not); "Edit" opens the
 * same fields, with the same controls, in an {@link EditSheet}: in place of the rows on a wider screen, a
 * sheet from the bottom edge on a phone. The fields write into the page's form
 * while the sheet is open, so conditions, unlocks and errors behave exactly as on the full form; Cancel
 * puts back what was there when the sheet opened, and Save saves the record and closes the sheet.
 */
export class RecordSectionCard extends Reactor {
  @prop declare section: { key: string; title?: string; fields: any[] };
  @prop declare formData: Record<string, any>;
  /** The page's own field renderer, so a field in the sheet is the field the full form would draw. */
  @prop declare renderField: (field: any) => ReactNode;
  @prop declare handlePatch: (partial: Record<string, any>) => void;
  @prop declare handleSubmit: () => Promise<unknown>;
  @prop declare saving: boolean;
  /** The page's last save error, in words; shown in the sheet when its own save fails. */
  @prop declare saveError?: string;
  /** What the record is called, under the sheet's title. */
  @prop declare recordTitle?: string;
  /** Records of other plugins placed in this section (payments under totals, a shipment under delivery). */
  @prop declare recordPart?: ReactNode;
  /** Forgets the page's last save error, so a sheet closed with Cancel leaves no failure behind it. */
  @prop declare clearSaveError?: () => void;

  @state open = false;
  @state failed = false;
  private before: Record<string, any> = {};

  @bound private openSheet(): void {
    this.before = RecordSectionFields.snapshot(this.section.fields, this.formData);
    this.failed = false;
    this.open = true;
  }

  @bound private cancel(): void {
    this.handlePatch(this.before);
    if (this.failed) this.clearSaveError?.();
    this.open = false;
  }

  @bound private async save(): Promise<void> {
    try {
      await this.handleSubmit();
      this.open = false;
    } catch {
      // The page has parsed the error into its message and each field's own error; the sheet stays open
      // so they are read next to the fields that caused them.
      this.failed = true;
    }
  }

  private renderValue(field: any): ReactNode {
    const raw = this.formData?.[field.name];
    if (RecordSectionFields.isMissing(field, raw)) {
      return <span className={AdminClass.of('record-card__missing')}>{AdminI18n.t('collection.edit.notFilledIn')}</span>;
    }
    const kind = String(field?.type || '');
    if (['text', 'textarea', 'email', 'url', 'slug', 'code'].includes(kind) && !field?.admin?.cell) {
      return FieldRendererUtils.resolveRenderableText(raw);
    }
    if (kind === 'richText') {
      return FieldRendererUtils.resolveRenderableText(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return RecordCellRenderers.renderCellValue({ columnName: field.name, field, header: FieldDisplayLabel.of(field), raw, row: this.formData });
  }

  private renderRows(): ReactNode {
    const shown = RecordSectionFields.shownFields(this.section.fields, this.formData);
    const own = this.section.fields.filter(RecordSectionFields.ownsItsControl);
    const card = AdminClass.of('record-card');
    if (!shown.length && !own.length) {
      return <p className={`${card}__empty`}>{AdminI18n.t('collection.edit.nothingFilledIn')}</p>;
    }
    return (
      <>
        {shown.length ? (
          <dl className={`${card}__rows`}>
            {shown.map((field) => (
              <div key={field.name} className={`${card}__row`}>
                <dt className={`${card}__label`}>{FieldDisplayLabel.of(field)}</dt>
                <dd className={`${card}__value`}>{this.renderValue(field)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {own.length ? (
          <div className="fc-edit-fields"><div className="fc-edit-fields__grid">{own.map(this.renderField)}</div></div>
        ) : null}
      </>
    );
  }

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    const title = this.section.title || '';
    const editable = RecordSectionFields.canEdit(this.section.fields);
    return (
      <Card id={`section-${this.section.key}`} noPadding className={this.open ? `${card} ${card}--editing` : card}>
        {title || editable ? (
          <div className={`${card}__head`}>
            <h2 className={`${card}__title`}>{title}</h2>
            {editable ? (
              <button type="button" className={`${card}__edit`} onClick={this.openSheet}>
                <FrameworkIcons.Edit size={14} />
                {AdminI18n.t('collection.edit.editSection')}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={`${card}__body`}>
          {this.renderSheet(title)}
          {this.renderRows()}
          {this.recordPart}
        </div>
      </Card>
    );
  }

  /** On a phone a sheet over the page; on a wider screen the fields in place of the rows they edit. */
  private renderSheet(title: string): ReactNode {
    return (
      <EditSheet
        isOpen={this.open}
        title={title || AdminI18n.t('collection.edit.editSection')}
        subtitle={this.recordTitle}
        onClose={this.cancel}
        onSave={this.save}
        saving={this.saving}
        error={this.failed ? this.saveError : ''}
      >
        <div className={AdminClass.of('sheet__group')}>
          <div className="fc-edit-fields"><div className="fc-edit-fields__grid">
            {RecordSectionFields.sheetFields(this.section.fields).map(this.renderField)}
          </div></div>
        </div>
      </EditSheet>
    );
  }
}
