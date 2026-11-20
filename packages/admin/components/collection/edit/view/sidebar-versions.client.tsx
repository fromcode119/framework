import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { VersionChangeSummary } from '@/components/collection/version-change-summary';

export class SidebarVersions extends PureReactor {
  @prop declare revisions: any[];
  @prop declare revisionsLoading: boolean;
  @prop declare activeVersionId: number | null;
  @prop declare setSelectedRevision: (rev: any) => void;
  @prop declare setFormData: (data: any) => void;
  @prop declare setActiveVersionId: (id: number) => void;
  @prop declare loadMoreRevisions: () => void;
  @prop declare hasMoreRevisions: boolean;
  @prop declare formData: any;
  /** The collection's fields, for the labels of what changed. */
  @prop declare fields: any[];

  /** What this version changed from the one before it, on one line: "Price: 10 → 12 · Title changed". */
  private changesLine(index: number): string {
    const older = this.revisions[index + 1];
    // The oldest version loaded: it is the creation when there is nothing further back, otherwise unknown until more is loaded.
    if (!older) return this.hasMoreRevisions ? '' : AdminI18n.t('collection.edit.versionCreated');
    const changes = VersionChangeSummary.between(this.revisions[index].changes, older.changes, this.fields);
    if (!changes) return '';
    if (changes.length === 0) return AdminI18n.t('collection.edit.versionNoFieldChanges');
    const shown = changes.slice(0, 4).map((change) => (change.from === change.to
      // Same text on both sides (a list of the same length, a long value cut short): it did change, and
      // "[1] → [1]" does not say so.
      ? `${change.label}: ${AdminI18n.t('collection.edit.versionValueChanged')}`
      : `${change.label}: ${change.from} → ${change.to}`));
    if (changes.length > shown.length) shown.push(AdminI18n.t('collection.edit.versionMoreChanges', { count: changes.length - shown.length }));
    return shown.join(' · ');
  }

  render(): ReactNode {
    const { revisions, revisionsLoading, activeVersionId, setSelectedRevision, setFormData, setActiveVersionId, loadMoreRevisions, hasMoreRevisions, formData } = this;
    return (
      <ListShell title={AdminI18n.t('collection.edit.versions')} count={revisions.length}
        foot={hasMoreRevisions && !revisionsLoading ? <Button variant={ButtonVariant.SECONDARY} onClick={loadMoreRevisions}>{AdminI18n.t('collection.edit.loadMoreVersions')}</Button> : undefined}>
        {revisions.length === 0 && !revisionsLoading ? <EmptyState inline title={AdminI18n.t('collection.edit.noVersions')} /> : (
          <div>
            {revisions.map((v, i) => {
              // What was done, then what changed; said once when both are the same word ("Created").
              const parts = [v.action, this.changesLine(i)].filter(Boolean);
              const line = [...new Set(parts)].join(' · ');
              // The version the record holds now: the chosen one, or the newest when none was chosen.
              const isCurrent = activeVersionId === null || activeVersionId === undefined ? i === 0 : v.id === activeVersionId;
              return (
                <ListRow
                  key={v.id ?? i}
                  title={<button type="button" className="fc-ext-row__link" onClick={() => setSelectedRevision(v)}>V{v.version} · {v.user}</button>}
                  badges={isCurrent ? <StateBadge tone="info">{AdminI18n.t('users.current')}</StateBadge> : undefined}
                  description={line || undefined}
                  descriptionTitle={line}
                  meta={v.date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  menu={isCurrent ? undefined : [{
                    label: AdminI18n.t('collection.edit.restore'),
                    icon: <FrameworkIcons.Refresh size={15} />,
                    onClick: () => { setFormData({ ...formData, ...v.changes }); setActiveVersionId(v.id); },
                  }]}
                />
              );
            })}
          </div>
        )}
        {revisionsLoading ? <Loader /> : null}
      </ListShell>
    );
  }
}
