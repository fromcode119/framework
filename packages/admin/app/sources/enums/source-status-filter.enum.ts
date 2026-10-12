import { Enum } from '@fromcode119/react-class-components';
import type { SourceRow } from '@/app/sources/source-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The values of the Sources status filter, and which rows each one keeps. */
export class SourceStatusFilter extends Enum {
  static readonly ALL = new SourceStatusFilter('all');
  static readonly ATTENTION = new SourceStatusFilter('attention');
  static readonly FAILED = new SourceStatusFilter('failed');
  static readonly BUILDING = new SourceStatusFilter('building');
  static readonly PENDING = new SourceStatusFilter('pending');
  /** Known only after "Check updates" has been pressed, so it is offered only then. */
  static readonly NEW_COMMITS = new SourceStatusFilter('newCommits');

  private constructor(value: string) {
    super(value);
  }

  static resolve(value: unknown): SourceStatusFilter {
    return (SourceStatusFilter.fromValue(String(value ?? '')) as SourceStatusFilter | undefined) ?? SourceStatusFilter.ALL;
  }

  /** Literal keys, one per member, so the key guard can see every one of them. */
  get label(): string {
    if (this === SourceStatusFilter.ATTENTION) return AdminI18n.t('sources.statusNeedsAttention');
    if (this === SourceStatusFilter.FAILED) return AdminI18n.t('sources.failed');
    if (this === SourceStatusFilter.BUILDING) return AdminI18n.t('sources.building');
    if (this === SourceStatusFilter.PENDING) return AdminI18n.t('sources.pending');
    if (this === SourceStatusFilter.NEW_COMMITS) return AdminI18n.t('sources.statusNewCommits');
    return AdminI18n.t('sources.filterAllStatuses');
  }

  keeps(row: SourceRow): boolean {
    if (this === SourceStatusFilter.ALL) return true;
    if (this === SourceStatusFilter.ATTENTION) return row.needsAttention;
    if (this === SourceStatusFilter.NEW_COMMITS) return row.hasNewCommits;
    return row.status === this.value;
  }
}
