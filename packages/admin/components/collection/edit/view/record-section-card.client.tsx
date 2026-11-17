import type { ReactNode, RefObject } from 'react';
import { prop, state, ref, bound } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { RecordPartPlace } from '@/components/collection/edit/enums/record-part-place.enum';
import { Card } from '@/components/ui/view/card.client';
import { RecordSectionSearch } from '@/components/collection/edit/view/record-section-search.client';
import { RecordSectionMenu } from '@/components/collection/edit/view/record-section-menu.client';
import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';
import { RecordSectionChips } from '@/components/collection/edit/record-section-chips';
import { RecordSectionCount } from '@/components/collection/edit/record-section-count';
import { RecordSectionCardEditing } from '@/components/collection/edit/view/record-section-card-editing.client';
import { RecordSectionData } from '@/components/collection/edit/record-section-data';
import { RecordSectionNamedRows } from '@/components/collection/edit/view/record-section-named-rows.client';
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
 *
 * What a plugin adds about one section goes INTO it, named by the section as declared (the same in every
 * language): `<slotBase>.<section>.head` beside the title (a state, a count), `.body` under the values
 * (a step to take, a related list) and `.menu` in the card's ⋯ menu, beside the Edit button.
 *
 * Editing keeps the card what it was: every field it shows stays, in the same order, and only what can
 * be changed turns into a control. A locked value stays with its lock, a recorded one stays as it reads.
 */
export class RecordSectionCard extends RecordSectionCardEditing {
  /** The page's own field renderer, so a field in the sheet is the field the full form would draw. */
  /** The page's last save error, in words; shown in the sheet when its own save fails. */
  /** What the record is called, under the sheet's title. */
  /**
   * Records of other plugins placed in this section (payments under totals, a shipment under delivery),
   * drawn at each place of the card it is asked for — see CollectionRecordPart.
   */
  @prop declare recordPart?: (place: RecordPartPlace) => ReactNode;
  /** Forgets the page's last save error, so a sheet closed with Cancel leaves no failure behind it. */
  /** `admin.collection.<slug>.edit.section`; with the section's key it names the section's slots. */
  @prop declare slotBase?: string;
  /** What every slot of the page is handed: the record, its setter, and saving. */
  @prop declare slotProps?: Record<string, any>;

  /** The section as declared, before translation; empty for a section no field names. */
  private get sectionKey(): string {
    return String(this.section.slotKey || this.section.fields.find((field: any) => field?.admin?.sectionKey)?.admin?.sectionKey || '');
  }

  /** `fallback` is drawn when no plugin fills the slot, and also when the section names no slots. */
  private slot(place: string, fallback: ReactNode = null): ReactNode {
    const key = this.sectionKey;
    return this.slotBase && key ? <Slot name={`${this.slotBase}.${key}.${place}`} props={this.slotProps || {}} fallback={fallback} /> : fallback;
  }

  /** Whether anything (a part, a plugin) put an action in the card's ⋯; without one there is no ⋯. */
  @state hasMenu = false;
  @ref declare private menuProbe: RefObject<HTMLSpanElement | null>;
  private menuWatch: MutationObserver | null = null;

  componentDidMount(): void {
    this.syncTableToolbar();
    const probe = this.menuProbe.current;
    if (!probe) return;
    const measure = () => { const filled = probe.childElementCount > 0; if (filled !== this.hasMenu) this.hasMenu = filled; };
    this.menuWatch = new MutationObserver(measure);
    this.menuWatch.observe(probe, { childList: true, subtree: true });
    measure();
  }

  componentDidUpdate(): void {
    this.syncTableToolbar();
  }

  componentWillUnmount(): void {
    this.menuWatch?.disconnect();
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
    const chips = RecordSectionChips.of(raw);
    if (chips) {
      return (
        <span className={AdminClass.of('chips')}>
          {chips.map((chip, at) => <span key={`${chip}-${at}`} className={AdminClass.of('chip')}>{chip}</span>)}
        </span>
      );
    }
    return RecordCellRenderers.renderCellValue({ columnName: field.name, field, header: FieldDisplayLabel.of(field), raw, row: this.formData });
  }


  /**
   * A section with fields of which none is filled in or drawn by a control of its own.
   *
   * Data the record holds counts as filled in. It did not, so a card whose whole content was a table of
   * four variants printed "nothing filled in" underneath it.
   */
  private isBlank(): boolean {
    const fields = this.section.fields;
    return fields.length > 0 && !RecordSectionFields.shownFields(fields, this.formData).length
      && !fields.some(RecordSectionFields.ownsItsControl) && !fields.some(RecordSectionFields.readsByComponent)
      && !RecordSectionFields.displayFields(fields, this.formData).length
      && !fields.some((field: any) => RecordSectionFields.readsAsData(field) && !RecordSectionFields.isEmpty(field, this.formData?.[field.name]));
  }

  private renderRows(tableField?: string): ReactNode {
    const shown = RecordSectionFields.shownFields(this.section.fields, this.formData);
    const own = this.section.fields.filter(RecordSectionFields.ownsItsControl);
    const read = this.section.fields.filter(RecordSectionFields.readsByComponent);
    const display = RecordSectionFields.displayFields(this.section.fields, this.formData);
    // Data the record holds — variants, choices, prices per currency — read as the table the console
    // draws for any recorded value. The section's sheet is where it changes.
    const data = this.section.fields.filter((field: any) => RecordSectionFields.readsAsData(field)
      && !RecordSectionFields.isEmpty(field, this.formData?.[field.name]));
    const card = AdminClass.of('record-card');
    // A section only parts fill (an order's invoices) says nothing of fields: the part speaks for itself.
    if (!this.section.fields.length) return null;
    // Nothing filled in: said by the body slot's fallback, so a card a plugin fills (a timeline) does not
    // also claim to be empty.
    if (!shown.length && !own.length && !read.length && !display.length && !data.length) return null;
    return (
      <>
        {read.map((field) => (
          <div key={`read-${field.name}`} className={`${card}__read`}>
            {this.renderField({ ...field, admin: { ...field.admin, component: field.admin.readComponent, hideLabel: true, description: undefined } })}
          </div>
        ))}
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
        {/* What the runtime recorded, under a heading of its own name, as rows like the ones above. */}
        {display.map((field) => this.renderRecorded(field, `${card}__read`))}
        {/* Data the record holds, read by the console's own structured renderer. */}
        {data.map((field) => this.renderAsData(field, `${card}__read`, field.name === tableField))}
        {/* A field that is its own control (an items table) reads under its name like a recorded value —
            a heading of the card, not a form label; when it IS what the card is called, the title says it. */}
        {own.map((field) => {
          const label = FieldDisplayLabel.of(field);
          const named = label && label.trim().toLowerCase() !== String(this.section.title || '').trim().toLowerCase();
          return (
            <section key={`own-${field.name}`} className={`${card}__own ${card}__recorded`}>
              {named ? <h3 className={`${card}__subhead`}>{label}</h3> : null}
              {this.renderField({ ...field, admin: { ...field.admin, hideLabel: true, description: undefined } })}
            </section>
          );
        })}
      </>
    );
  }


  /** The way to another record, for a table row that leads to one. */
  @prop declare navigate?: (href: string) => void;

  /** What the section's search holds. Nothing is stored: it is how the card is being read now. */
  @state private searchText = '';

  /** Where the section's head keeps room for the table's own toolbar, once the head has drawn it. */
  @ref declare private tableToolbarRef: RefObject<HTMLDivElement | null>;
  @state private tableToolbar: HTMLDivElement | null = null;

  private syncTableToolbar(): void {
    const target = this.tableToolbarRef.current;
    if (target !== this.tableToolbar) this.tableToolbar = target;
  }

  /** The one field of this section that reads as a table, if the section is exactly one table. */
  private get sectionTableField(): string | undefined {
    return RecordSectionData.tableField(this.section.fields, this.formData);
  }

  /** How many rows the section's own data holds — what decides whether a search is worth offering. */
  private get dataRowCount(): number {
    return RecordSectionData.rowCount(this.section.fields, this.formData);
  }

  /** What a record part or a plugin adds to this section's ⋯. */
  @bound private offers(): ReactNode {
    return <>{this.recordPart?.(RecordPartPlace.MENU)}{this.slot('menu')}</>;
  }

  @bound private onSearch(next: string): void {
    this.searchText = next;
  }

  /**
   * A field whose value is data, read as the structured table the console draws for any recorded value.
   * Its own control is not drawn here — the section's Edit opens it with the real thing.
   */
  private renderAsData(field: any, extra: string, withToolbar: boolean): ReactNode {
    const card = AdminClass.of('record-card');
    const label = FieldDisplayLabel.of(field);
    const named = label && label.trim().toLowerCase() !== String(this.section.title || '').trim().toLowerCase();
    return (
      <section key={`data-${field.name}`} className={`${extra} ${card}__recorded`.trim()}>
        {named ? <h3 className={`${card}__subhead`}>{label}</h3> : null}
        {this.renderField({
          ...field,
          admin: {
          ...field.admin, component: 'StructuredReadOnlyField', hideLabel: true, description: undefined, readOnly: true, readOnlyOverride: 'never',
          // A read table's rows each carry a ⋯ that opens this section's editor — the one place the row's
          // real controls live. It is not scoped to the row it sits on, because the value is one field of
          // the record and the sheet edits that field whole.
          onEditRow: RecordSectionFields.canEdit([field]) ? this.openSheet : undefined,
          tableToolbar: withToolbar ? this.tableToolbar : undefined,
          // Where a ROW leads, straight from the field's own declaration, plus the way to get there.
          tableRowHref: field?.admin?.tableRowHref,
          navigate: this.navigate,
          // What the section's own search holds; the table narrows itself to it.
          searchText: this.searchText,
        },
        })}
      </section>
    );
  }

  /** What the runtime recorded, under a heading of its own name; the same in the card and in the sheet. */
  protected renderRecorded(field: any, extra = ''): ReactNode {
    const card = AdminClass.of('record-card');
    return (
      <section key={`display-${field.name}`} className={`${extra} ${card}__recorded`.trim()}>
        <h3 className={`${card}__subhead`}>{FieldDisplayLabel.of(field)}</h3>
        {this.renderField({ ...field, admin: { ...field.admin, hideLabel: true, description: undefined, readOnly: true, readOnlyOverride: 'never' } })}
      </section>
    );
  }

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    const title = this.section.title || '';
    const editable = RecordSectionFields.canEdit(this.section.fields);
    const tableField = this.sectionTableField;
    return (
      <Card id={`section-${this.section.key}`} noPadding className={this.open ? `${card} ${card}--editing` : card}>
        {title || editable ? (
          <div className={`${card}__head`}>
            <h2 className={`${card}__title`}>
              {title}
              {RecordSectionCount.of(this.section.fields, this.formData) !== null
                ? <span className={`${card}__count`}>{RecordSectionCount.of(this.section.fields, this.formData)}</span>
                : null}
            </h2>
            <div className={`${card}__aside`}>
              {tableField
                ? <div className="fc-record-card__table-tools" ref={this.tableToolbarRef} />
                : <RecordSectionSearch rows={this.dataRowCount} value={this.searchText} onChange={this.onSearch} />}
              {this.recordPart?.(RecordPartPlace.HEAD)}{this.slot('head')}
            </div>
            <RecordSectionMenu
              editable={editable}
              hasOffers={this.hasMenu}
              offers={this.offers}
              probeRef={this.menuProbe}
              onEdit={this.openSheet}
            />
          </div>
        ) : null}
        <div className={`${card}__body`}>
          {this.renderSheet(title)}
          {this.recordPart?.(RecordPartPlace.LEAD)}
          {this.renderRows(tableField)}
          {this.recordPart?.(RecordPartPlace.BODY)}
          {this.slot('body', this.isBlank() ? <RecordSectionNamedRows fields={this.section.fields} /> : null)}
        </div>
      </Card>
    );
  }

}
