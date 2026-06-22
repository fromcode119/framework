"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Loader } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { AdminComponent } from '@/components/admin-component';
import type { Person, PeoplePageState } from './people-page.interfaces';

export default class PeoplePage extends AdminComponent<Record<string, never>, PeoplePageState> {
  private mounted = false;

  private static readonly PAGE_SIZE = 10;

  state: PeoplePageState = {
    searchQuery: '',
    page: 1,
    people: [],
    loading: true,
    stats: { total: 0, linked: 0, unlinked: 0 },
    grantConfirm: null,
    isGranting: false,
    error: '',
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.fetchPeople();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchPeople(): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PEOPLE);
      const people: Person[] = response.docs || [];
      if (!this.mounted) return;
      const linked = people.filter((p) => p.userId != null && p.userId !== '').length;
      this.setState({ people, stats: { total: people.length, linked, unlinked: people.length - linked } });
    } catch (err) {
      console.error('Failed to fetch people:', err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async grantLogin(): Promise<void> {
    const person = this.state.grantConfirm;
    if (!person) return;
    this.setState({ isGranting: true, error: '' });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.PERSON_CREATE_USER(person.id), {
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
      });
      await this.fetchPeople();
      this.setState({ grantConfirm: null });
    } catch (err: any) {
      this.setState({ error: String(err?.message || 'Failed to create login account') });
    } finally {
      this.setState({ isGranting: false });
    }
  }

  private displayName(person: Person): string {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    return person.displayName || name || person.email || `Person #${person.id}`;
  }

  private static sourceLabel(p: Person): string {
    return (p.source || 'contact').toString();
  }

  private get filteredPeople(): Person[] {
    const q = this.state.searchQuery.toLowerCase();
    const base = !q
      ? this.state.people
      : this.state.people.filter((p) =>
          this.displayName(p).toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q),
        );
    // Sort by source so the grouped table renders each source's rows contiguously.
    return [...base].sort((a, b) => {
      const s = PeoplePage.sourceLabel(a).localeCompare(PeoplePage.sourceLabel(b));
      return s !== 0 ? s : this.displayName(a).localeCompare(this.displayName(b));
    });
  }

  private get columns(): any[] {
    const theme = this.theme;
    return [
      {
        header: 'Person', id: 'person',
        accessor: (p: Person) => (
          <div>
            <div className={`font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{this.displayName(p)}</div>
            <div className="text-[11px] font-bold tracking-tight text-slate-500 flex items-center gap-1 opacity-70">
              <FrameworkIcons.Mail size={12} /> {p.email || '—'}{p.phone ? ` · ${p.phone}` : ''}
            </div>
          </div>
        ),
      },
      {
        header: 'Login account', id: 'linked',
        accessor: (p: Person) => (p.userId != null && p.userId !== '')
          ? <span className="font-bold text-emerald-500 text-[11px] tracking-tight flex items-center gap-1"><FrameworkIcons.UserCheck size={14} /> Linked (#{p.userId})</span>
          : <span className="font-bold text-slate-400 text-[11px] tracking-tight">No account</span>,
      },
      {
        header: 'Added', id: 'createdAt',
        accessor: (p: Person) => (
          <div className="flex items-center gap-2 font-bold text-[11px] tracking-tight text-slate-500">
            <FrameworkIcons.Calendar size={14} className="opacity-50" />
            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
          </div>
        ),
      },
    ];
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { searchQuery, page, loading, stats, grantConfirm, isGranting, error } = this.state;
    const limit = PeoplePage.PAGE_SIZE;
    const filtered = this.filteredPeople;
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * limit, currentPage * limit);

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Loading people…" />
        </div>
      );
    }

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Users size={18} strokeWidth={2} />}
          title="People"
          subtitle="Everyone in the unified identity model — customers, subscribers and contacts."
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="People" value={stats.total.toLocaleString()} icon={<FrameworkIcons.Users size={20} />} />
            <StatCard title="With login account" value={stats.linked.toLocaleString()} icon={<FrameworkIcons.UserCheck size={20} />} />
            <StatCard title="Contacts only" value={stats.unlinked.toLocaleString()} icon={<FrameworkIcons.Mail size={20} />} />
          </div>

          {error ? <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-[12px] font-bold dark:bg-rose-500/10">{error}</div> : null}

          <div className="relative flex-1 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><FrameworkIcons.Search size={18} /></div>
            <input
              type="text" placeholder="Search people by name or email…" value={searchQuery}
              onChange={(e) => this.setState({ searchQuery: e.target.value, page: 1 })}
              className={`w-full h-9 rounded-lg pl-11 pr-4 outline-none border text-[13px] font-medium tracking-tight ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            />
          </div>

          <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <DataTable
              columns={this.columns}
              data={pageItems}
              loading={false}
              totalDocs={filtered.length}
              limit={limit}
              page={currentPage}
              onPageChange={(p) => this.setState({ page: p })}
              groupBy={(person: Person) => PeoplePage.sourceLabel(person)}
              emptyMessage="No people match your query"
              actions={(person: Person) => (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    className="h-9 px-3 rounded-xl font-bold tracking-tight text-[11px]"
                    icon={<FrameworkIcons.Edit size={14} />}
                    onClick={() => this.router?.push(AdminConstants.ROUTES.PEOPLE.DETAIL(person.id))}
                  >
                    Edit
                  </Button>
                  {(person.userId != null && person.userId !== '') ? (
                    <span className="text-[11px] font-bold text-slate-400 pr-2">Linked</span>
                  ) : (
                    <Button
                      variant="secondary"
                      className="h-9 px-4 rounded-xl font-bold tracking-tight text-[11px]"
                      icon={<FrameworkIcons.Plus size={14} />}
                      onClick={() => this.setState({ grantConfirm: person })}
                      disabled={!person.email}
                    >
                      Create login account
                    </Button>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        <ConfirmDialog
          isOpen={!!grantConfirm}
          onClose={() => this.setState({ grantConfirm: null })}
          onConfirm={() => this.grantLogin()}
          isLoading={isGranting}
          title="Create login account?"
          description={`This creates a login account for ${grantConfirm?.email} and links it to this person. They can set a password via password reset.`}
          confirmLabel="Create account"
        />

        <AdminPageFooter
          label="Unified Identity"
          description="People are the canonical identity across all plugins; a login account is optional."
          links={[{ label: 'Users', href: AdminConstants.ROUTES.USERS.ROOT }]}
        />
      </div>
    );
  }
}
