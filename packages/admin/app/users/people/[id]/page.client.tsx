import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons, RecordsHub } from '@fromcode119/react';
import type { IRecordsHubItem } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Input } from '@/components/ui/view/input.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PersonAccountPanel } from '@/app/users/people/[id]/components/view/person-account-panel.client';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import type { IPersonEditPageFields } from '@/app/users/people/[id]/interfaces/person-edit-page-fields.interface';
import { bound, prop, state } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

/** Dedicated edit page for a single person (route `/users/people/:id`). Replaces the modal dialog. */
export class PersonEditPage extends AdminComponent {
  @prop declare params: Promise<{ id: string }>;

  @state routeId = '';
  @state person: IPerson | null = null;
  @state fields: IPersonEditPageFields = { firstName: '', lastName: '', displayName: '', phone: '', birthDate: '' };
  @state loading = true;
  @state saving = false;
  @state granting = false;
  @state sendingReset = false;
  @state notice = '';
  @state error = '';
  @state notFound = false;
  /** Set when the person request FAILED. Distinct from `notFound`, which means the server answered
   *  and the record does not exist — a failed request must never be reported as "does not exist". */
  @state loadError = '';
  @state users: Array<{ id: number; email?: string; username?: string }> = [];
  @state confirmDelete = false;
  @state deleting = false;
  @state reassignOpen = false;
  @state reassignTo = '';
  @state reassigning = false;

  private mounted = false;

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

  @bound
  async retryLoad(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    await this.fetchPerson();
  }

  private async fetchPerson(): Promise<void> {
    try {
      const res = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.routeId));
      const person: IPerson = res?.person;
      if (!this.mounted) return;
      this.person = person;
      this.fields = PersonEditPage.toFields(person);
      this.loading = false;
      this.notFound = !person;
      void AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS)
        .then((u: any) => { if (this.mounted) this.users = Array.isArray(u?.docs) ? u.docs : (Array.isArray(u) ? u : []); })
        .catch(() => undefined);
    } catch (err: any) {
      if (this.mounted) {
        this.loading = false;
        this.loadError = err?.message || 'The person record could not be loaded.';
      }
    }
  }

  private static toFields(person: IPerson | null): IPersonEditPageFields {
    return {
      firstName: String(person?.firstName ?? ''),
      lastName: String(person?.lastName ?? ''),
      displayName: String(person?.displayName ?? ''),
      phone: String(person?.phone ?? ''),
      birthDate: String(person?.birthDate ?? ''),
    };
  }

  private set<K extends keyof IPersonEditPageFields>(key: K, value: string): void {
    this.fields = { ...this.fields, [key]: value };
  }

  private async save(e?: FormEvent): Promise<void> {
    e?.preventDefault();
    this.saving = true;
    this.error = '';
    try {
      await AdminApi.patch(AdminConstants.ENDPOINTS.SYSTEM.PERSON_SAVE(this.routeId), this.fields);
      this.router?.push(AdminConstants.ROUTES.PEOPLE.ROOT);
    } catch (err: any) {
      this.error = String(err?.message || 'Failed to save person');
      this.saving = false;
    }
  }

  private async grantLogin(): Promise<void> {
    const person = this.person;
    if (!person?.email) return;
    this.granting = true;
    this.error = '';
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.PERSON_CREATE_USER(this.routeId), {
        email: person.email, firstName: person.firstName, lastName: person.lastName,
      });
      await this.fetchPerson();
    } catch (err: any) {
      this.error = String(err?.message || 'Failed to create login account');
    } finally {
      this.granting = false;
    }
  }

  /** Admin-trigger: (re)send the linked user a password-reset / set-password email. */
  private async sendPasswordReset(): Promise<void> {
    const userId = this.person?.userId;
    if (userId == null || userId === '') return;
    this.sendingReset = true;
    this.error = '';
    this.notice = '';
    try {
      const res: any = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.ADMIN_SEND_PASSWORD_RESET, { userId });
      this.sendingReset = false;
      this.notice = res?.emailSent === false
        ? 'Reset link generated, but the email could not be sent — check SMTP settings.'
        : `Password reset email sent to ${res?.email || this.person?.email || 'the user'}.`;
    } catch (err: any) {
      this.sendingReset = false;
      this.error = String(err?.message || 'Failed to send password reset email');
    }
  }

  /** Delete this person (the linked login account, if any, is kept). */
  private async remove(): Promise<void> {
    this.deleting = true;
    this.error = '';
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.routeId));
      this.router?.push(AdminConstants.ROUTES.PEOPLE.ROOT);
    } catch (err: any) {
      this.deleting = false;
      this.confirmDelete = false;
      this.error = String(err?.message || 'Failed to delete person');
    }
  }

  /** Reassign (or clear, when reassignTo === '__none__') the linked login account. */
  private async reassign(): Promise<void> {
    const userId = this.reassignTo === '__none__' ? null : this.reassignTo;
    this.reassigning = true;
    this.error = '';
    this.notice = '';
    try {
      await AdminApi.post(`${AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.routeId)}/link-user`, { userId });
      this.reassigning = false;
      this.reassignOpen = false;
      this.notice = userId ? 'Login account reassigned.' : 'Login account unlinked.';
      await this.fetchPerson();
    } catch (err: any) {
      this.reassigning = false;
      this.error = String(err?.message || 'Failed to reassign the login account');
    }
  }

  /** Open a hub record: navigate to its admin page (href) or download its document (downloadUrl). */
  private async openRecord(item: IRecordsHubItem): Promise<void> {
    if (item.downloadUrl) {
      try {
        const res: any = await AdminApi.get(item.downloadUrl);
        const base64 = String(res?.base64 ?? res?.file?.base64 ?? '');
        if (base64) {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: res?.mimeType || 'application/pdf' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = String(res?.filename || res?.fileName || `${item.title}.pdf`);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          return;
        }
        if (res?.url) { window.open(String(res.url), '_blank', 'noopener'); return; }
      } catch { /* fall through to href */ }
    }
    if (item.href) {
      if (/^https?:\/\//i.test(item.href)) window.open(item.href, '_blank', 'noopener');
      else this.router?.push(item.href);
    }
  }

  private field(label: string, key: keyof IPersonEditPageFields, type = 'text'): ReactNode {
    return (
      <label className="block">
        <span className="block text-[11px] font-bold tracking-tight text-slate-500 mb-1.5">{label}</span>
        <Input type={type} value={this.fields[key]} disabled={this.saving}
          onChange={(e) => this.set(key, e.target.value)} className="w-full" />
      </label>
    );
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
              onOpenItem={(item: IRecordsHubItem) => void this.openRecord(item)}
            />
          </div>
        </div>
      </div>
    );
  }
}
