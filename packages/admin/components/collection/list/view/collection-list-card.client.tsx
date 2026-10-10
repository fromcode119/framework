import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { CollectionListMediaCellValue } from '@/components/collection/list/view/media-cell-value.client';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One record on a phone: thumbnail, title and the trailing value on top, the meta line under it, and
 * the badge beside the record's actions. Every part is a field the collection's list layout names,
 * drawn by the same cell renderer the table uses — so a value reads the same on both, and a value the
 * collection made editable in place is editable here too.
 */
export class CollectionListCard extends PureReactor {
  declare props: Pick<CollectionListCard, 'row' | 'layout' | 'cells' | 'actions' | 'expanded' | 'onOpen' | 'selected' | 'onToggle'>;

  @prop declare row: any;
  @prop declare layout: CollectionListLayout;
  /** Cell renderers by field name, with in-place editing already applied. */
  @prop declare cells: ReadonlyMap<string, (row: any) => ReactNode>;
  @prop declare actions: ReactNode;
  /** The quick edit form, when it is open on this record. */
  @prop declare expanded: ReactNode;
  @prop declare onOpen: (row: any) => void;
  @prop declare selected: boolean;
  /** Adds the record to, or takes it out of, the selection the bulk actions work on. */
  @prop declare onToggle: (id: string) => void;

  @bound private open(): void {
    this.onOpen(this.row);
  }

  @bound private toggle(event: { stopPropagation(): void }): void {
    event.stopPropagation();
    this.onToggle(String(this.row.id));
  }

  private cell(name: string): ReactNode {
    const render = name ? this.cells.get(name) : undefined;
    return render ? render(this.row) : null;
  }

  private get meta(): ReactNode[] {
    return this.layout.metaFields
      .map((name) => ({ name, value: this.row[name] }))
      .filter(({ value }) => value !== null && value !== undefined && value !== '')
      .map(({ name }) => (
        <span key={name} className="min-w-0 truncate">
          {this.layout.valueLabels[name] ? <span className="text-slate-400 dark:text-slate-500">{this.layout.valueLabels[name]} </span> : null}
          {this.cell(name)}
        </span>
      ));
  }

  private renderMeta(): ReactNode {
    const meta = this.meta;
    if (!meta.length) return null;
    return (
      <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[12px] font-medium text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap">
        {meta.flatMap((part, index) => (index ? [<span key={`dot-${index}`} className="text-slate-300 dark:text-slate-600">·</span>, part] : [part]))}
      </div>
    );
  }

  render(): ReactNode {
    const { layout, row } = this;
    const hasMedia = Boolean(layout.mediaField) && MediaRelationFieldUtils.getSelectedIds(row[layout.mediaField]).length > 0;
    return (
      <div className={`border-t border-slate-100 dark:border-slate-800/70 first:border-t-0 ${this.expanded ? 'bg-slate-50/80 dark:bg-slate-800/30' : ''}`}>
        <div className={`flex gap-3 pl-3 pr-4 py-3 cursor-pointer ${this.selected ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''}`} onClick={this.open}>
          <button type="button" onClick={this.toggle} aria-pressed={this.selected} aria-label={AdminI18n.t('collection.list.selectRecord')} className="shrink-0 self-start p-1 -m-0.5">
            <Checkbox checked={this.selected} presentational />
          </button>
          {hasMedia ? <div className="shrink-0"><CollectionListMediaCellValue raw={row[layout.mediaField]} thumbnail /></div> : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {this.cell(layout.titleField) ?? `#${row.id}`}
              </div>
              {layout.trailingField ? (
                <div className="shrink-0 text-[14px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  {layout.valueLabels[layout.trailingField] ? <span className="mr-1 text-[12px] font-medium text-slate-400 dark:text-slate-500">{layout.valueLabels[layout.trailingField]}</span> : null}
                  {this.cell(layout.trailingField)}
                </div>
              ) : null}
            </div>
            {this.renderMeta()}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0 whitespace-nowrap">{this.cell(layout.badgeField)}</div>
              {this.actions}
            </div>
          </div>
        </div>
        {this.expanded ? <div className="px-4 pb-4">{this.expanded}</div> : null}
      </div>
    );
  }
}
