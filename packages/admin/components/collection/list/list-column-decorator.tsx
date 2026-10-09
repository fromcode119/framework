import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import type { CollectionAccess } from '@/lib/collection-access';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { CollectionListMediaCellValue } from '@/components/collection/list/view/media-cell-value.client';
import { InlineEditValue } from '@/components/collection/list/view/inline-edit-value.client';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';

/**
 * Turns the plain columns into the ones the list shows, from the collection's list layout.
 *
 * Two things change. The title column carries the record's thumbnail and number when those columns
 * are not shown on their own — the operator's column choice decides, so nothing appears twice. And a
 * field the collection declared in `quickEdit.inline` becomes a value the operator can click to edit,
 * for anyone allowed to change the record.
 */
export class ListColumnDecorator {
  static decorate(columns: any[], context: {
    collection: any;
    layout: CollectionListLayout;
    access: CollectionAccess;
    resolvedSlug: string;
    theme: ThemeMode;
    pluginSettings: Record<string, any>;
    onSaved: () => void;
  }): any[] {
    const visible = new Set(columns.map((column) => column.id));
    return columns.map((column) => {
      const field = ListColumnDecorator.fieldOf(context.collection, column.id);
      let accessor = column.accessor;
      if (field && context.access.canUpdate && context.layout.isInline(column.id)) {
        accessor = ListColumnDecorator.inline(accessor, field, context);
      }
      if (column.id === context.layout.titleField) {
        // The title is what a row is read by; without a floor it is the column the table squeezes
        // first, down to one word per line.
        return { ...column, accessor: ListColumnDecorator.title(accessor, context.layout, visible), className: `${column.className || ''} min-w-[14rem]` };
      }
      return accessor === column.accessor ? column : { ...column, accessor };
    });
  }

  /**
   * Every column's cell renderer by field name, for the phone cards. A card shows the fields the layout
   * names whether or not they are table columns right now, so this starts from ALL columns, and only
   * in-place editing is applied — the card draws its own thumbnail and title.
   */
  static cells(allColumns: any[], context: {
    collection: any;
    layout: CollectionListLayout;
    access: CollectionAccess;
    resolvedSlug: string;
    theme: ThemeMode;
    pluginSettings: Record<string, any>;
    onSaved: () => void;
  }): Map<string, (row: any) => ReactNode> {
    const cells = new Map<string, (row: any) => ReactNode>();
    for (const column of allColumns) {
      const field = ListColumnDecorator.fieldOf(context.collection, column.id);
      const editable = field && context.access.canUpdate && context.layout.isInline(column.id);
      cells.set(column.id, editable ? ListColumnDecorator.inline(column.accessor, field, context) : column.accessor);
    }
    return cells;
  }

  private static fieldOf(collection: any, name: string): any {
    return (collection?.fields || []).find((entry: any) => entry?.name === name);
  }

  private static inline(accessor: (row: any) => ReactNode, field: any, context: {
    resolvedSlug: string; theme: ThemeMode; pluginSettings: Record<string, any>; onSaved: () => void;
  }): (row: any) => ReactNode {
    return (row: any) => (
      <InlineEditValue row={row} field={field} resolvedSlug={context.resolvedSlug} theme={context.theme} pluginSettings={context.pluginSettings} onSaved={context.onSaved}>
        {accessor(row)}
      </InlineEditValue>
    );
  }

  private static title(accessor: (row: any) => ReactNode, layout: CollectionListLayout, visible: Set<string>): (row: any) => ReactNode {
    const showMedia = Boolean(layout.mediaField) && !visible.has(layout.mediaField);
    const showNumber = !visible.has('id');
    if (!showMedia && !showNumber) return accessor;
    return (row: any) => (
      <div className="flex items-center gap-3 min-w-[14rem] max-w-[28rem]">
        {showMedia && MediaRelationFieldUtils.getSelectedIds(row[layout.mediaField]).length
          ? <CollectionListMediaCellValue raw={row[layout.mediaField]} />
          : null}
        <div className="min-w-0">
          <div className="line-clamp-2 text-slate-900 dark:text-slate-100">{accessor(row)}</div>
          {showNumber ? <div className="mt-0.5 text-[12px] font-medium text-slate-400">#{row.id}</div> : null}
        </div>
      </div>
    );
  }
}
