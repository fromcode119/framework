import { ExtensionScope } from '@fromcode119/core/client';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { SourceStatusFilter } from '@/app/sources/enums/source-status-filter.enum';
import type { SourceRow } from '@/app/sources/source-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the Sources list is narrowed to — search, kind and status — and the filters that change it.
 *
 * The kinds offered are the kinds the installation actually tracks, read from the rows: a filter
 * option for a kind with no sources would be an empty list under a heading that promises one.
 */
export class SourceListQuery {
  static readonly ALL_TYPES = 'all';

  constructor(
    readonly search: string,
    readonly type: string,
    readonly status: SourceStatusFilter,
  ) {}

  matches(row: SourceRow): boolean {
    return (this.type === SourceListQuery.ALL_TYPES || row.type === this.type)
      && this.status.keeps(row)
      && row.matches(this.search);
  }

  /** `checked` is whether "Check updates" has answered, which is when new commits become knowable. */
  filters(rows: readonly SourceRow[], checked: boolean, onType: (value: string) => void, onStatus: (value: string) => void): ListFilter[] {
    return [
      new ListFilter('type', AdminI18n.t('sources.filterType'), this.typeOptions(rows), this.type, SourceListQuery.ALL_TYPES, onType),
      new ListFilter('status', AdminI18n.t('sources.filterStatus'), SourceListQuery.statusOptions(rows, checked), String(this.status.value), String(SourceStatusFilter.ALL.value), onStatus),
    ];
  }

  private typeOptions(rows: readonly SourceRow[]): { label: string; value: string }[] {
    const kinds = [...new Set(rows.map((row) => row.type))].sort();
    return [
      { label: AdminI18n.t('sources.filterAllTypes'), value: SourceListQuery.ALL_TYPES },
      ...kinds.map((kind) => ({ label: SourceListQuery.counted(SourceListQuery.kindLabel(kind), rows.filter((row) => row.type === kind).length), value: kind })),
    ];
  }

  private static statusOptions(rows: readonly SourceRow[], checked: boolean): { label: string; value: string }[] {
    const statuses = [SourceStatusFilter.ATTENTION, SourceStatusFilter.FAILED, SourceStatusFilter.BUILDING, SourceStatusFilter.PENDING];
    if (checked) statuses.push(SourceStatusFilter.NEW_COMMITS);
    return [
      { label: SourceStatusFilter.ALL.label, value: String(SourceStatusFilter.ALL.value) },
      ...statuses.map((status) => ({
        label: SourceListQuery.counted(status.label, rows.filter((row) => status.keeps(row)).length),
        value: String(status.value),
      })),
    ];
  }

  /** The kind in the admin's language, falling back to the kind's own name for one this admin has no words for. */
  static kindLabel(kind: string): string {
    return AdminI18n.optional(`sources.kindPlural.${kind}`) || ExtensionScope.definitions().find((entry) => entry.value === kind)?.label || kind;
  }

  private static counted(label: string, count: number): string {
    return `${label} (${count})`;
  }
}
