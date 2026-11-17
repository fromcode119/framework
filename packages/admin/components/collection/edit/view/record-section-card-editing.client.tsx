import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The EDITING half of a section card: the sheet, the values it was opened with, and what Cancel and
 * Save do with them. {@link RecordSectionCard} builds on it and does the reading.
 *
 * Split along the same line the console already uses for `Dropdown` over `DropdownPositioning`: the
 * card got long because it does two things, and the two barely touch — one draws values, the other
 * holds the form open over them.
 */
export abstract class RecordSectionCardEditing extends Reactor {
  /** How the card draws a value the runtime recorded; the sheet shows it the same way. */
  protected abstract renderRecorded(field: any, extra?: string): ReactNode;

  @prop declare section: { key: string; title?: string; fields: any[]; slotKey?: string };
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
  /** Forgets the page's last save error, so a sheet closed with Cancel leaves no failure behind it. */
  @prop declare clearSaveError?: () => void;

  @state open = false;
  @state failed = false;
  /** Whether anything (a part, a plugin) put an action in the card's ⋯; without one there is no ⋯. */
  private before: Record<string, any> = {};

  /**
   * Which ROW of a data table the sheet was opened on; null when it was opened on the section.
   *
   * A row's menu could only offer "edit this field", which put every other row of the table on screen
   * and asked for the wanted one to be found again inside.
   */
  @state protected rowKey: string | null = null;

  /** Opens the section's fields in the sheet, with the values it was opened on remembered. */
  @bound protected openSheet(rowKey?: string): void {
    this.before = RecordSectionFields.snapshot(this.section.fields, this.formData);
    this.failed = false;
    this.rowKey = typeof rowKey === 'string' && rowKey ? rowKey : null;
    this.open = true;
  }

  /** What the table's field offers for making one more of its rows, drawn in the card's tool row. */
  protected renderTableCreate(): ReactNode {
    const field = this.section.fields.find((one: any) => one?.admin?.tableCreate);
    if (!field) return null;
    return this.renderField({
      ...field,
      admin: { ...field.admin, component: field.admin.tableCreate, hideLabel: true, description: undefined },
    });
  }

  /** The field whose table offers a row of its own to edit, and the component that edits one. */
  protected get rowField(): any {
    return this.section.fields.find((field: any) => field?.admin?.tableRowComponent) ?? null;
  }

  @bound private cancel(): void {
    this.handlePatch(this.before);
    if (this.failed) this.clearSaveError?.();
    this.open = false;
    this.rowKey = null;
  }

  @bound private async save(): Promise<void> {
    try {
      await this.handleSubmit();
      this.open = false;
      this.rowKey = null;
    } catch {
      // The page has parsed the error into its message and each field's own error; the sheet stays open
      // so they are read next to the fields that caused them.
      this.failed = true;
    }
  }

  /** On a phone a sheet over the page; on a wider screen the fields in place of the rows they edit. */
  protected renderSheet(title: string): ReactNode {
    const row = this.rowKey;
    const rowField = row ? this.rowField : null;
    return (
      <EditSheet
        isOpen={this.open}
        title={row && rowField ? row : (title || AdminI18n.t('collection.edit.editSection'))}
        subtitle={this.recordTitle}
        onClose={this.cancel}
        onSave={this.save}
        saving={this.saving}
        error={this.failed ? this.saveError : ''}
      >
        <div className={AdminClass.of('sheet__group')}>
          <div className="fc-edit-fields"><div className="fc-edit-fields__grid">
            {row && rowField
              ? this.renderField({ ...rowField, admin: { ...rowField.admin, component: rowField.admin.tableRowComponent, hideLabel: true, description: undefined, rowKey: row } })
              : RecordSectionFields.editDrawn(this.section.fields, this.formData).map((field) => (
                RecordSectionFields.displaysOnly(field) ? this.renderRecorded(field) : this.renderField(field)
              ))}
          </div></div>
        </div>
      </EditSheet>
    );
  }
}
