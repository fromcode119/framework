import { Tabs } from '@/components/ui/view/tabs.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { VersionChangeSummary } from '@/components/collection/version-change-summary';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class RevisionModal extends PureReactor {
  @prop declare selectedRevision: any;
  @prop declare setSelectedRevision: (rev: any) => void;
  @prop declare showOnlyChanges: boolean;
  @prop declare setShowOnlyChanges: (val: boolean) => void;
  @prop declare formData: any;
  @prop declare setFormData: (data: any) => void;
  @prop declare theme: any;
  @prop declare currentRevIndex: number;
  @prop declare revisions: any[];
  @prop declare restoringPermanently: boolean;
  @prop declare handleHardRestore: (version: number) => void;
  @prop declare setActiveVersionId: (id: number) => void;
  @prop declare setStatus: (status: { type: NotificationType, message: string } | null) => void;
  /** The collection's fields, so each row is named the way the form names it. */
  @prop declare fields?: any[];

  /** Moving between versions on the left; what to do with this one on the right. */
  private get foot(): React.ReactNode {
    const { selectedRevision, setSelectedRevision, currentRevIndex, revisions, formData, setFormData,
      setActiveVersionId, setStatus, restoringPermanently, handleHardRestore } = this;
    return (
      <>
        <Button
          variant={ButtonVariant.SECONDARY}
          disabled={currentRevIndex >= revisions.length - 1}
          onClick={() => setSelectedRevision(revisions[currentRevIndex + 1])}
        >
          {AdminI18n.t('collection.revision.older')}
        </Button>
        <Button
          variant={ButtonVariant.SECONDARY}
          disabled={currentRevIndex <= 0}
          onClick={() => setSelectedRevision(revisions[currentRevIndex - 1])}
        >
          {AdminI18n.t('collection.revision.newer')}
        </Button>
        <Button
          variant={ButtonVariant.SECONDARY}
          onClick={() => {
            setFormData({ ...formData, ...selectedRevision.changes });
            setActiveVersionId(selectedRevision.id);
            setSelectedRevision(null);
            setStatus({ type: NotificationType.SUCCESS, message: AdminI18n.t('collection.revision.applied') });
          }}
        >
          {AdminI18n.t('collection.revision.previewInForm')}
        </Button>
        <Button
          variant={ButtonVariant.PRIMARY}
          isLoading={restoringPermanently}
          onClick={() => handleHardRestore(selectedRevision.version)}
        >
          {AdminI18n.t('collection.revision.restorePermanently')}
        </Button>
      </>
    );
  }

  render(): React.ReactNode {
    const { selectedRevision, setSelectedRevision, showOnlyChanges, setShowOnlyChanges, formData, restoringPermanently } = this;
    if (!selectedRevision) return null;
    const all = VersionChangeSummary.compare(formData, selectedRevision.changes, this.fields || []);
    const rows = showOnlyChanges ? all.filter((row) => row.changed) : all;

    return (
      <EditSheet
        isOpen
        onClose={() => setSelectedRevision(null)}
        title={AdminI18n.t('collection.revision.title', { version: selectedRevision.version })}
        subtitle={AdminI18n.t('collection.revision.meta', { date: selectedRevision.date.toLocaleString(), user: selectedRevision.user })}
        saving={restoringPermanently}
        foot={this.foot}
      >
        <div className="fc-form-stack">
          <Tabs value={showOnlyChanges ? 'changes' : 'all'} onChange={(key: string) => setShowOnlyChanges(key === 'changes')}
            tabs={[
              { id: 'changes', label: AdminI18n.t('collection.revision.onlyChanges'), count: all.filter((row) => row.changed).length },
              { id: 'all', label: AdminI18n.t('collection.revision.allFields'), count: all.length },
            ]} />
          {rows.length === 0 ? <EmptyState inline title={AdminI18n.t('collection.revision.noChanges')} /> : (
            <div className="fc-compare" role="table">
              <div className="fc-compare__row fc-compare__row--head" role="row">
                <span role="columnheader" />
                <span role="columnheader">{AdminI18n.t('collection.revision.current')}</span>
                <span role="columnheader">{AdminI18n.t('collection.revision.versionValues', { version: selectedRevision.version })}</span>
              </div>
              {rows.map((row) => (
                <div key={row.key} className={`fc-compare__row${row.changed ? ' fc-compare__row--changed' : ''}`} role="row">
                  <span className="fc-compare__label" role="rowheader">{row.label}</span>
                  <span className="fc-compare__was" role="cell">{row.current}</span>
                  <span className="fc-compare__now" role="cell">{row.version}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </EditSheet>
    );
  }
}
