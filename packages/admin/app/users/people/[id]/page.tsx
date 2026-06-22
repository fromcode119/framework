"use client";

import React from 'react';
import Link from 'next/link';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons, RecordsHub } from '@fromcode119/react';
import type { RecordsHubItem } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { Input } from '@/components/ui/input';
import { AdminComponent } from '@/components/admin-component';
import { PersonAccountPanel } from './person-account-panel';
import type { Person } from '../people-page.interfaces';
import type { PersonEditPageProps, PersonEditPageState, PersonEditPageFields } from './person-edit-page.interfaces';

/** Dedicated edit page for a single person (route `/users/people/:id`). Replaces the modal dialog. */
export default class PersonEditPage extends AdminComponent<PersonEditPageProps, PersonEditPageState> {
  private mounted = false;

  state: PersonEditPageState = {
    routeId: '',
    person: null,
    fields: { firstName: '', lastName: '', displayName: '', phone: '', birthDate: '' },
    loading: true,
    saving: false,
    granting: false,
    error: '',
    notFound: false,
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.setState({ routeId: params.id }, () => void this.fetchPerson());
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchPerson(): Promise<void> {
    try {
      const res = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.state.routeId));
      const person: Person = res?.person;
      if (!this.mounted) return;
      this.setState({ person, fields: PersonEditPage.toFields(person), loading: false, notFound: !person });
    } catch {
      if (this.mounted) this.setState({ loading: false, notFound: true });
    }
  }

  private static toFields(person: Person | null): PersonEditPageFields {
    return {
      firstName: String(person?.firstName ?? ''),
      lastName: String(person?.lastName ?? ''),
      displayName: String(person?.displayName ?? ''),
      phone: String(person?.phone ?? ''),
      birthDate: String(person?.birthDate ?? ''),
    };
  }

  private set<K extends keyof PersonEditPageFields>(key: K, value: string): void {
    this.setState({ fields: { ...this.state.fields, [key]: value } });
  }

  private async save(e?: React.FormEvent): Promise<void> {
    e?.preventDefault();
    this.setState({ saving: true, error: '' });
    try {
      await AdminApi.patch(AdminConstants.ENDPOINTS.SYSTEM.PERSON_SAVE(this.state.routeId), this.state.fields);
      this.router?.push(AdminConstants.ROUTES.PEOPLE.ROOT);
    } catch (err: any) {
      this.setState({ error: String(err?.message || 'Failed to save person'), saving: false });
    }
  }

  private async grantLogin(): Promise<void> {
    const person = this.state.person;
    if (!person?.email) return;
    this.setState({ granting: true, error: '' });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.PERSON_CREATE_USER(this.state.routeId), {
        email: person.email, firstName: person.firstName, lastName: person.lastName,
      });
      await this.fetchPerson();
    } catch (err: any) {
      this.setState({ error: String(err?.message || 'Failed to create login account') });
    } finally {
      this.setState({ granting: false });
    }
  }

  /** Open a hub record: navigate to its admin page (href) or download its document (downloadUrl). */
  private async openRecord(item: RecordsHubItem): Promise<void> {
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

  private field(label: string, key: keyof PersonEditPageFields, type = 'text'): React.ReactNode {
    return (
      <label className="block">
        <span className="block text-[11px] font-bold tracking-tight text-slate-500 mb-1.5">{label}</span>
        <Input type={type} value={this.state.fields[key]} disabled={this.state.saving}
          onChange={(e) => this.set(key, e.target.value)} className="w-full" />
      </label>
    );
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { person, loading, saving, granting, error, notFound } = this.state;

    if (loading) {
      return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Loading person…" /></div>;
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
          theme={theme}
          backHref={AdminConstants.ROUTES.PEOPLE.ROOT}
          icon={<FrameworkIcons.Edit size={18} strokeWidth={2} />}
          title="Edit person"
          subtitle={`${person.email || `Person #${person.id}`} · ${person.source || 'contact'} · ${linked ? `Linked (#${person.userId})` : 'No login account'}`}
        />

        <div className="flex-1 w-full px-6 lg:px-12 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
            <form onSubmit={(e) => this.save(e)} className={`rounded-3xl border p-8 space-y-5 ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
              <h3 className={`text-[11px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Identity</h3>
              {error ? <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-[12px] font-bold dark:bg-rose-500/10">{error}</div> : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {this.field('First name', 'firstName')}
                {this.field('Last name', 'lastName')}
              </div>
              {this.field('Display name', 'displayName')}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {this.field('Phone', 'phone', 'tel')}
                {this.field('Birth date', 'birthDate', 'date')}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="primary" type="submit" isLoading={saving} className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px]">Save changes</Button>
                <Link href={AdminConstants.ROUTES.PEOPLE.ROOT} className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px] flex items-center text-slate-500 hover:text-slate-700">Cancel</Link>
              </div>
            </form>
            <PersonAccountPanel person={person} theme={theme} granting={granting} onGrantLogin={() => this.grantLogin()} />
          </div>

          <div className="mt-6">
            <RecordsHub
              theme={theme}
              title="Documents & records"
              emptyHint="No documents or records linked to this person yet."
              reloadKey={person.id}
              load={() => AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_RECORDS(this.state.routeId))}
              onOpenItem={(item) => void this.openRecord(item)}
            />
          </div>
        </div>
      </div>
    );
  }
}
