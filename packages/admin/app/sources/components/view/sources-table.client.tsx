import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Column } from '@/components/ui/column';
import { AdminClass } from '@/lib/admin-class';
import { BuildStatusBadge } from '@/app/sources/components/view/build-status-badge.client';
import { SourceRowActions } from '@/app/sources/components/view/source-row-actions.client';
import { SourceDetails } from '@/app/sources/components/view/source-details.client';
import type { SourceRow } from '@/app/sources/source-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The Sources list as the admin's DataTable: one line per source, opened in place for the rest.
 *
 * A card per source with its changelog spelled out cost about 80px a source, so forty sources were
 * several screens of scrolling. One line each, with the detail one click away, fits them on one.
 */
export class SourcesTable extends PureReactor {
  declare props: Pick<SourcesTable, 'rows' | 'loading' | 'emptyMessage' | 'openId' | 'page' | 'limit' | 'totalDocs' | 'buildingId' | 'onPageChange' | 'onToggle' | 'onBuild' | 'onEdit' | 'onRemove'>;

  @prop declare rows: SourceRow[];
  @prop declare loading: boolean;
  @prop declare emptyMessage: string;
  @prop declare openId: string | null;
  @prop declare page: number;
  @prop declare limit: number;
  @prop declare totalDocs: number;
  @prop declare buildingId: string | null;
  @prop declare onPageChange: (page: number) => void;
  @prop declare onToggle: (row: SourceRow) => void;
  @prop declare onBuild: (row: SourceRow) => void;
  @prop declare onEdit: (row: SourceRow) => void;
  @prop declare onRemove: (row: SourceRow) => void;

  private get columns(): Column<SourceRow>[] {
    return [
      { id: 'source', header: AdminI18n.t('sources.columnSource'), accessor: SourcesTable.renderSource },
      { id: 'version', header: AdminI18n.t('sources.columnVersion'), accessor: SourcesTable.renderVersion },
      { id: 'status', header: AdminI18n.t('sources.columnStatus'), accessor: SourcesTable.renderStatus },
      { id: 'lastChange', header: AdminI18n.t('sources.columnLastChange'), accessor: SourcesTable.renderLastChange, className: 'max-w-0 w-full' },
    ];
  }

  private static renderSource(row: SourceRow): ReactNode {
    return (
      <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-slate-900 dark:text-white">{row.slug}</span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{SourcesTable.kind(row.type)}</span>
      </span>
    );
  }

  private static renderVersion(row: SourceRow): ReactNode {
    return (
      <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
        <span>{row.version ? `v${row.version}` : <span className="font-medium text-slate-400">{AdminI18n.t('sources.noBuildYetShort')}</span>}</span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{row.branch}</span>
      </span>
    );
  }

  private static renderStatus(row: SourceRow): ReactNode {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <BuildStatusBadge status={row.status} />
        {row.hasNewCommits ? <Badge variant={BadgeVariant.INFO}>{AdminI18n.t('sources.statusNewCommits')}</Badge> : null}
      </span>
    );
  }

  /** Nothing when no build recorded a change, so a phone card leaves the line off instead of an empty label. */
  private static renderLastChange(row: SourceRow): ReactNode {
    if (!row.lastChange) return '';
    return <span className="block truncate font-medium text-slate-500 dark:text-slate-400" title={row.lastChange}>{row.lastChange}</span>;
  }

  /** The kind in the admin's language when it has words for it, else as the server names it. */
  private static kind(type: string): string {
    return AdminI18n.optional(`sources.kindSingular.${type}`) || type;
  }

  @bound private renderActions(row: SourceRow): ReactNode {
    return <SourceRowActions row={row} building={this.buildingId === row.id} onBuild={this.onBuild} onEdit={this.onEdit} onRemove={this.onRemove} />;
  }

  @bound private renderDetails(row: SourceRow): ReactNode {
    return <SourceDetails row={row} />;
  }

  render(): ReactNode {
    // The admin's surface, as Jobs and every collection list sit on: without it the rows and phone
    // cards floated on the page background and read as transparent.
    return (
      <div className={`${AdminClass.SURFACE} overflow-hidden`}>
      <DataTable
        columns={this.columns}
        data={this.rows}
        loading={this.loading}
        emptyMessage={this.emptyMessage}
        onRowClick={this.onToggle}
        actions={this.renderActions}
        stickyActions={false}
        expandedRowId={this.openId}
        renderExpandedRow={this.renderDetails}
        page={this.page}
        limit={this.limit}
        totalDocs={this.totalDocs}
        onPageChange={this.onPageChange}
      />
      </div>
    );
  }
}
