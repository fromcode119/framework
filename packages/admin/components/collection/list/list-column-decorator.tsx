import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import type { CollectionAccess } from '@/lib/collection-access';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { CollectionListMediaCellValue } from '@/components/collection/list/view/media-cell-value.client';
import { InlineEditValue } from '@/components/collection/list/view/inline-edit-value.client';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import { AdminLink } from '@/components/view/admin-link.client';

/**
 * Turns the plain columns into the ones the list shows, from the collection's list layout.
 *
 * Two things change. The title column is the link to the record and carries its thumbnail, and its
 * number when that column is not shown and the title alone does not tell records apart — the operator's
 * column choice decides, so nothing appears twice. And a
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
    /** The admin path of a record — the title links there, so a row opens from the keyboard and in a new tab. */
    recordHref: (row: any) => string;
  }): any[] {
    const visible = new Set(columns.map((column) => column.id));
    return columns.map((column) => {
      const field = ListColumnDecorator.fieldOf(context.collection, column.id);
      let accessor = column.accessor;
      if (field && context.access.canUpdate && context.layout.isInline(column.id)) {
        accessor = ListColumnDecorator.inline(accessor, field, context);
      }
      if (column.id === context.layout.titleField) {
        // The title is what a row is read by. A table cell holds one line, so a long title ends in "…"
        // at 28rem instead of pushing every other column off the screen.
        const linked = accessor === column.accessor ? ListColumnDecorator.linked(accessor, context.recordHref) : accessor;
        const numbered = !visible.has('id') && !ListColumnDecorator.identifies(context.collection, column.id);
        return { ...column, accessor: ListColumnDecorator.title(linked, context.layout, visible, numbered) };
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

  /** The title as a link to its record; the row's own click already opens it, so the link does not open it twice. */
  private static linked(accessor: (row: any) => ReactNode, recordHref: (row: any) => string): (row: any) => ReactNode {
    return (row: any) => (
      <AdminLink href={recordHref(row)} onClick={ListColumnDecorator.stop} className="fc-dt-title-link">{accessor(row)}</AdminLink>
    );
  }

  private static stop(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
  }

  /** Whether a field's value alone tells one record from another — declared unique, on the field or as an index of it alone. */
  private static identifies(collection: any, name: string): boolean {
    if (ListColumnDecorator.fieldOf(collection, name)?.unique) return true;
    const indexes: any[] = Array.isArray(collection?.indexes) ? collection.indexes : [];
    return indexes.some((index) => index?.unique && Array.isArray(index.fields) && index.fields.length === 1 && index.fields[0] === name);
  }

  private static title(accessor: (row: any) => ReactNode, layout: CollectionListLayout, visible: Set<string>, showNumber: boolean): (row: any) => ReactNode {
    const showMedia = Boolean(layout.mediaField) && !visible.has(layout.mediaField);
    if (!showMedia && !showNumber) return accessor;
    return (row: any) => (
      <div className="flex items-center gap-3 max-w-[28rem]">
        {showMedia && MediaRelationFieldUtils.getSelectedIds(row[layout.mediaField]).length
          ? <CollectionListMediaCellValue raw={row[layout.mediaField]} />
          : null}
        <div className="min-w-0">
          <div className="truncate text-slate-900 dark:text-slate-100">{accessor(row)}</div>
          {showNumber ? <div className="mt-0.5 text-[12px] font-medium text-slate-400">#{row.id}</div> : null}
        </div>
      </div>
    );
  }
}
