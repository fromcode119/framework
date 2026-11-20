import { ListShell } from '@/components/ui/view/list-shell.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Column } from '@/components/ui/column';
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
        <span className="fc-tone-text">{row.slug}</span>
        <span className="fc-size-xs font-medium fc-tone-muted">{SourcesTable.kind(row.type)}</span>
      </span>
    );
  }

  private static renderVersion(row: SourceRow): ReactNode {
    return (
      <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
        <span>{row.version ? `v${row.version}` : <span className="font-medium fc-tone-muted">{AdminI18n.t('sources.noBuildYetShort')}</span>}</span>
        <span className="fc-size-xs font-medium fc-tone-muted">{row.branch}</span>
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
    return <span className="block truncate font-medium fc-tone-muted" title={row.lastChange}>{row.lastChange}</span>;
  }

  /** The kind in the admin's language when it has words for it, else as the server names it. */
  private static kind(type: string): string {
    return AdminI18n.optional(`sources.kindSingular.${type}`) || type;
  }

  @bound private renderActions(row: SourceRow): ReactNode {
    return <SourceRowActions row={row} building={this.buildingId === row.id} onBuild={this.onBuild} onEdit={this.onEdit} onRemove={this.onRemove} />;
  }

  /** The row that is open, if any. */
  private get opened(): SourceRow | null {
    return this.openId ? this.rows.find((row) => String(row.id) === String(this.openId)) ?? null : null;
  }

  @bound private closeDetails(): void {
    const row = this.opened;
    if (row) this.onToggle(row);
  }

  render(): ReactNode {
    // The list card every list in the console stands in.
    return (
      <ListShell>
      <DataTable
        columns={this.columns}
        data={this.rows}
        loading={this.loading}
        emptyMessage={this.emptyMessage}
        onRowClick={this.onToggle}
        actions={this.renderActions}
        stickyActions={false}
        page={this.page}
        limit={this.limit}
        totalDocs={this.totalDocs}
        onPageChange={this.onPageChange}
      />
      {/* A source's details, in the sheet at the side. They used to unfold under its row. */}
      {this.opened ? (
        <EditSheet isOpen title={this.opened.slug} subtitle={SourcesTable.kind(this.opened.type)} onClose={this.closeDetails}
          foot={<Button variant={ButtonVariant.SECONDARY} onClick={this.closeDetails}>{AdminI18n.t('common.close')}</Button>}>
          <SourceDetails row={this.opened} />
        </EditSheet>
      ) : null}
      </ListShell>
    );
  }
}
