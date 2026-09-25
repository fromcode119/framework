import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons, RecordsHub } from '@fromcode119/react';
import type { IRecordsHubItem } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { PersonAccountPanel } from '@/app/users/people/[id]/components/view/person-account-panel.client';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { AdminClass } from '@/lib/admin-class';
import { PersonEditPageActions } from '@/app/users/people/[id]/page-actions.client';

/**
 * One person — the record behind a customer or a colleague.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `PersonEditPageState`.
 */
export class PersonEditPage extends PersonEditPageActions {
  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.routeId = params.id;
    void this.fetchPerson();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactElement {
    const theme = this.theme;
    const { person, loading, saving, granting, sendingReset, notice, error, notFound, loadError, users, confirmDelete, deleting, reassignOpen, reassignTo, reassigning } = this;

    if (loading) {
      return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Loading person…" /></div>;
    }

    if (loadError) {
      return (
        <LoadErrorPanel
          title="This person could not be loaded"
          message={loadError}
          onRetry={this.retryLoad}
          isRetrying={loading}
        />
      );
    }

    if (notFound || !person) {
      return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="font-bold text-slate-400">This person could not be found.</p>
          <Link href={AdminConstants.ROUTES.PEOPLE.ROOT} className="text-indigo-600 font-bold text-sm">← Back to People</Link>
        </div>
      );
    }

    const linked = person.userId != null && person.userId !== '';

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme.value}
          backHref={AdminConstants.ROUTES.PEOPLE.ROOT}
          icon={<FrameworkIcons.Edit size={18} strokeWidth={2} />}
          title="Edit person"
          subtitle={`${person.email || `IPerson #${person.id}`} · ${person.source || 'contact'} · ${linked ? `Linked (#${person.userId})` : 'No login account'}`}
        />

        <div className="flex-1 w-full px-6 lg:px-12 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
            <form onSubmit={(e) => this.save(e)} className={`${AdminClass.SURFACE} p-8 space-y-5 ${theme === ThemeMode.DARK ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
              <h3 className={`text-[11px] font-bold uppercase tracking-wider ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>Identity</h3>
              {error ? <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-[12px] font-bold dark:bg-rose-500/10">{error}</div> : null}
              {notice ? <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-2.5 text-[12px] font-bold dark:bg-emerald-500/10">{notice}</div> : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {this.field('First name', 'firstName')}
                {this.field('Last name', 'lastName')}
              </div>
              {this.field('Display name', 'displayName')}
              {this.field('Email', 'email', 'email', linked)}
              {linked ? <p className="-mt-3 text-[11px] text-slate-400">This person has a login account; its email is changed on the account.</p> : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {this.field('Phone', 'phone', 'tel')}
                {this.field('Birth date', 'birthDate', 'date')}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button variant={ButtonVariant.PRIMARY} type="submit" isLoading={saving} className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px]">Save changes</Button>
                {linked ? (
                  <Button variant={ButtonVariant.SECONDARY} type="button" isLoading={sendingReset} onClick={() => this.sendPasswordReset()}
                    className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px]">Send password reset email</Button>
                ) : null}
                <Link href={AdminConstants.ROUTES.PEOPLE.ROOT} className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px] flex items-center text-slate-500 hover:text-slate-700">Cancel</Link>
              </div>
            </form>
            <PersonAccountPanel person={person} theme={theme.value} granting={granting} onGrantLogin={() => this.grantLogin()} />
          </div>

          <div className={`mt-6 ${AdminClass.SURFACE} p-6 ${theme === ThemeMode.DARK ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
            <h3 className={`text-[11px] font-bold uppercase tracking-wider ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'} mb-4`}>Account management</h3>
            <div className="flex flex-wrap items-center gap-3">
              {reassignOpen ? (
                <>
                  <select value={reassignTo} onChange={(e) => { this.reassignTo = e.target.value; }}
                    className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-[12px] font-bold">
                    <option value="__none__">— No login account (unlink) —</option>
                    {users.map((u) => <option key={u.id} value={String(u.id)}>{u.email || u.username || `user #${u.id}`} · #{u.id}</option>)}
                  </select>
                  <Button variant={ButtonVariant.PRIMARY} type="button" isLoading={reassigning} disabled={!reassignTo} onClick={() => this.reassign()} className="h-10 px-5 rounded-xl font-bold text-[12px]">Apply</Button>
                  <Button variant={ButtonVariant.SECONDARY} type="button" onClick={() => { this.reassignOpen = false; }} className="h-10 px-5 rounded-xl font-bold text-[12px]">Cancel</Button>
                </>
              ) : (
                <Button variant={ButtonVariant.SECONDARY} type="button" icon={<FrameworkIcons.UserCheck size={14} />}
                  onClick={() => { this.reassignOpen = true; this.reassignTo = linked ? String(person.userId) : '__none__'; }}
                  className="h-10 px-5 rounded-xl font-bold text-[12px]">Reassign / unlink login</Button>
              )}
              {confirmDelete ? (
                <>
                  <Button variant={ButtonVariant.DANGER} type="button" isLoading={deleting} onClick={() => this.remove()} className="h-10 px-5 rounded-xl font-bold text-[12px]">Confirm — delete person</Button>
                  <Button variant={ButtonVariant.SECONDARY} type="button" onClick={() => { this.confirmDelete = false; }} className="h-10 px-5 rounded-xl font-bold text-[12px]">Keep</Button>
                </>
              ) : (
                <Button variant={ButtonVariant.DANGER} type="button" icon={<FrameworkIcons.Trash size={14} />} onClick={() => { this.confirmDelete = true; }} className="h-10 px-5 rounded-xl font-bold text-[12px]">Delete person</Button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Deleting removes the person record permanently; the linked login account is kept.</p>
          </div>

          <div className="mt-6">
            <RecordsHub
              theme={theme.value}
              title="Documents & records"
              emptyHint="No documents or records linked to this person yet."
              reloadKey={person.id}
              load={() => AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_RECORDS(this.routeId))}
              onOpenItem={(item: IRecordsHubItem) => this.openRecord(item)}
              onDownloadItem={(item: IRecordsHubItem) => void this.downloadRecord(item)}
            />
          </div>
        </div>
      </div>
    );
  }
}
