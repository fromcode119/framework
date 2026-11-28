import { RecordCard } from '@/components/ui/view/record-card.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Hint } from '@/components/ui/view/hint.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactElement } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons, RecordsHub } from '@fromcode119/react';
import type { IRecordsHubItem } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { SiteScopeGate } from '@/components/view/site-scope-gate.client';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { PersonFieldsPanel } from '@/app/users/people/[id]/components/view/person-fields-panel.client';
import { PersonAccountPanel } from '@/app/users/people/[id]/components/view/person-account-panel.client';
import { PersonEmailsPanel } from '@/app/users/people/[id]/components/view/person-emails-panel.client';
import { AdminClass } from '@/lib/admin-class';
import { PersonEditPageActions } from '@/app/users/people/[id]/page-actions.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Select } from '@/components/ui/view/select.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';

/**
 * One person — the record behind a customer or a colleague.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `PersonEditPageState`.
 */
export class PersonEditPage extends PersonEditPageActions {
  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.pending = new PendingSave(() => this.fields, () => this.save(), (values) => { this.fields = values; });
    const params = await this.params;
    if (!this.mounted) return;
    this.routeId = params.id;
    void this.fetchPerson();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
  }

  render(): ReactElement {
    const theme = this.theme;
    const { person, loading, granting, sendingReset, notice, error, notFound, loadError, users, confirmDelete, deleting, reassignOpen, reassignTo, reassigning } = this;

    if (loading) {
      return <Loader fullPage label={AdminI18n.t('users.loadingPerson')} />;
    }

    if (loadError) {
      return (
        <LoadErrorPanel
          title={AdminI18n.t('users.thisPersonCouldNotBe')}
          message={loadError}
          onRetry={this.retryLoad}
          isRetrying={loading}
        />
      );
    }

    if (notFound || !person) {
      // People belong to a site. With no site selected, "not found" usually means "in a site": say so,
      // as the plugin pages do, instead of implying the person does not exist.
      return (
        <SiteScopeGate what={AdminI18n.t('users.people2', { routeId: this.routeId })}>
          <StatePage title={AdminI18n.t('users.thisPersonCouldNotBe2')} actions={<Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={AdminConstants.ROUTES.PEOPLE.ROOT}>{AdminI18n.t('users.backToPeople')}</Button>} />
        </SiteScopeGate>
      );
    }

    const linked = person.userId != null && person.userId !== '';

    return (
      <div className={`w-full flex flex-col ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={theme.value}
          backHref={AdminConstants.ROUTES.PEOPLE.ROOT}
          icon={<FrameworkIcons.Edit size={18} strokeWidth={2} />}
          title={AdminI18n.t('users.editPerson')}
          subtitle={`${person.email || AdminI18n.t('users.person', { id: person.id })} · ${person.source || AdminI18n.t('users.sourceContact')} · ${linked ? AdminI18n.t('users.linked2', { userId: person.userId }) : AdminI18n.t('users.noLoginAccount')}`}
        />

        <div className="fc-columns__stack">
          <div className="fc-record-split">
            <div>
              <RecordCard title={AdminI18n.t('users.identity')}>
                <div className="fc-stack">
                  {error ? <Alert tone="danger">{error}</Alert> : null}
                  {notice ? <Alert tone="success">{notice}</Alert> : null}
                  <div className="fc-form-grid">
                    {this.field(AdminI18n.t('users.firstName2'), 'firstName')}
                    {this.field(AdminI18n.t('users.lastName2'), 'lastName')}
                    {this.field(AdminI18n.t('users.displayName'), 'displayName')}
                    {this.field('Email', 'email', 'email', linked)}
                    {this.field('Phone', 'phone', 'tel')}
                    {this.field(AdminI18n.t('users.birthDate'), 'birthDate', 'date')}
                  </div>
                  {linked ? <Hint>{AdminI18n.t('users.thisPersonHasALogin')}</Hint> : null}
                  {linked ? (
                    <div className="fc-chip-row fc-chip-row--cell">
                      <Button variant={ButtonVariant.SECONDARY} type="button" isLoading={sendingReset} onClick={() => this.sendPasswordReset()}>{AdminI18n.t('users.sendPasswordResetEmail')}</Button>
                    </div>
                  ) : null}
                </div>
              </RecordCard>
            </div>
            <PersonAccountPanel person={person} theme={theme.value} granting={granting} onGrantLogin={() => this.grantLogin()} />
          </div>

          <PersonFieldsPanel personId={person.id} theme={theme} />

          <PersonEmailsPanel address={person.email || ''} />

          <RecordCard title={AdminI18n.t('users.accountManagement')}>
            <div className="fc-stack">
              <div className="fc-chip-row fc-chip-row--cell">
                {reassignOpen ? (
                  <>
                    <Select
                      className="w-72"
                      value={reassignTo}
                      onChange={(value) => { this.reassignTo = value; }}
                      options={[
                        { label: AdminI18n.t('users.noLoginAccountUnlink'), value: '__none__' },
                        ...users.map((u) => ({ label: `${u.email || u.username || AdminI18n.t('users.userNumber', { id: u.id })} · #${u.id}`, value: String(u.id) })),
                      ]}
                    />
                    <Button variant={ButtonVariant.PRIMARY} type="button" isLoading={reassigning} disabled={!reassignTo} onClick={() => this.reassign()}>{AdminI18n.t('users.apply')}</Button>
                    <Button variant={ButtonVariant.SECONDARY} type="button" onClick={() => { this.reassignOpen = false; }}>{AdminI18n.t('users.cancel')}</Button>
                  </>
                ) : (
                  <Button variant={ButtonVariant.SECONDARY} type="button" icon={<FrameworkIcons.UserCheck size={15} />}
                    onClick={() => { this.reassignOpen = true; this.reassignTo = linked ? String(person.userId) : '__none__'; }}>{AdminI18n.t('users.reassignUnlinkLogin')}</Button>
                )}
                <Button variant={ButtonVariant.DANGER} type="button" icon={<FrameworkIcons.Trash size={15} />} onClick={() => { this.confirmDelete = true; }}>{AdminI18n.t('users.deletePerson')}</Button>
              </div>
              <Hint>{AdminI18n.t('users.deletingRemovesThePersonRecord')}</Hint>
            </div>
          </RecordCard>

          {/* The admin's own confirmation, as every other destructive action uses — not a second pair of
              buttons swapped in beside the first, which read as part of the toolbar. */}
          <ConfirmDialog
            isOpen={confirmDelete}
            onClose={() => { this.confirmDelete = false; }}
            onConfirm={() => this.remove()}
            title={AdminI18n.t('users.deleteThisPerson')}
            description={AdminI18n.t(linked ? 'users.isRemovedFromPeopleKeepsLogin' : 'users.isRemovedFromPeoplePermanently', { name: person.displayName || [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || AdminI18n.t('users.person', { id: person.id }) })}
            confirmLabel={AdminI18n.t('users.deletePerson')}
            variant={ButtonVariant.DANGER}
            isLoading={deleting}
          />

          <div>
            <RecordsHub
              title={AdminI18n.t('users.documentsRecords')}
              emptyHint={AdminI18n.t('users.noDocumentsOrRecordsLinked')}
              reloadKey={person.id}
              load={() => AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_RECORDS(this.routeId))}
              onOpenItem={(item: IRecordsHubItem) => this.openRecord(item)}
              onDownloadItem={(item: IRecordsHubItem) => void this.downloadRecord(item)}
            />
          </div>
          <PendingSavesBar />
        </div>
      </div>
    );
  }
}
