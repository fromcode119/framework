import type { ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTablePagination } from '@/components/ui/view/data-table-pagination.client';
import { PeopleRow } from '@/app/users/people/components/view/people-row.client';
import { PeopleListFilter } from '@/app/users/people/enums/people-list-filter.enum';
import { Loader } from '@/components/ui/view/loader.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/react-class-components';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { SiteRequiredNotice } from '@/components/view/site-required-notice.client';
import { Input } from '@/components/ui/view/input.client';

export class PeoplePage extends AdminComponent {
  private mounted = false;

  private static readonly PAGE_SIZE = 20;

  @state searchQuery = '';
  @state page = 1;
  @state people: IPerson[] = [];
  @state loading = true;
  /** Which of the counted tabs is open. */
  @state filter: PeopleListFilter = PeopleListFilter.ALL;
  @state grantConfirm: IPerson | null = null;
  @state isGranting = false;
  @state error = '';

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
      const people: IPerson[] = response.docs || [];
      if (!this.mounted) return;
      this.people = people;
    } catch (err) {
      console.error('Failed to fetch people:', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async grantLogin(): Promise<void> {
    const person = this.grantConfirm;
    if (!person) return;
    this.isGranting = true;
    this.error = '';
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.PERSON_CREATE_USER(person.id), {
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
      });
      await this.fetchPeople();
      this.grantConfirm = null;
    } catch (err: any) {
      this.error = String(err?.message || AdminI18n.t('users.failedToCreateLoginAccount'));
    } finally {
      this.isGranting = false;
    }
  }

  private displayName(person: IPerson): string {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    return person.displayName || name || person.email || AdminI18n.t('users.person', { id: person.id });
  }

  private static sourceLabel(p: IPerson): string {
    return (p.source || 'contact').toString();
  }

  private get filteredPeople(): IPerson[] {
    const q = this.searchQuery.toLowerCase();
    const inTab = this.people.filter((p) => this.filter.matches(p));
    const base = !q
      ? inTab
      : inTab.filter((p) =>
          this.displayName(p).toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q),
        );
    // Sorted by source, then name, so people from one source sit together.
    return [...base].sort((a, b) => {
      const s = PeoplePage.sourceLabel(a).localeCompare(PeoplePage.sourceLabel(b));
      return s !== 0 ? s : this.displayName(a).localeCompare(this.displayName(b));
    });
  }


  /** People belong to a site: with none to hold them, the screen says so instead (SiteRequiredNotice). */
  render(): ReactElement {
    return <SiteRequiredNotice subject="people">{this.renderPeople()}</SiteRequiredNotice>;
  }

  private renderPeople(): ReactElement {
    const theme = this.theme;
    const { searchQuery, page, loading, grantConfirm, isGranting, error } = this;
    const limit = PeoplePage.PAGE_SIZE;
    const filtered = this.filteredPeople;
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * limit, currentPage * limit);

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label={AdminI18n.t('users.loadingPeople')} />
        </div>
      );
    }

    return (
      <div className={`w-full flex flex-col animate-in fade-in duration-500 ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={theme}
          title={AdminI18n.t('users.people')}
          subtitle={AdminI18n.t('users.everyoneInTheUnifiedIdentity')}
        />

        <div className="w-full p-6">
          {error ? <div className={`${AdminClass.of('ext-alert')} ${AdminClass.of('ext-alert--danger')}`} role="alert"><span className={AdminClass.of('ext-alert__text')}>{error}</span></div> : null}

          <div className={AdminClass.of('ext-tabbar')}>
            <nav className={AdminClass.of('ext-tabs')} aria-label={AdminI18n.t('users.people')}>
              {PeopleListFilter.all().map((filter) => (
                <button key={filter.value} type="button" className={AdminClass.of('ext-tabs__tab')}
                  aria-current={this.filter === filter ? 'page' : undefined}
                  onClick={() => { this.filter = filter; this.page = 1; }}>
                  {AdminI18n.t(filter.labelKey)}<span className={AdminClass.of('ext-tabs__count')}>{this.people.filter((p) => filter.matches(p)).length}</span>
                </button>
              ))}
            </nav>
            <div className={AdminClass.of('ext-toolbar')}>
              <div className={AdminClass.of('ext-toolbar__search')}>
                <FrameworkIcons.Search size={16} />
                <Input
                  type="text" placeholder={AdminI18n.t('users.searchPeopleByNameOr')} value={searchQuery}
                  onChange={(e) => { this.searchQuery = e.target.value; this.page = 1; }}
                  inputClassName="ps-10"
                />
              </div>
            </div>
          </div>

          {pageItems.length === 0 ? (
            <div className={`${AdminClass.of('ext-list')} ${AdminClass.of('ext-empty')}`}>{AdminI18n.t('users.noPeopleMatchYourQuery')}</div>
          ) : (
            <div className={AdminClass.of('ext-list')}>
              {pageItems.map((person) => (
                <PeopleRow key={person.id} person={person} name={this.displayName(person)} source={PeoplePage.sourceLabel(person)}
                  onEdit={() => this.router?.push(AdminConstants.ROUTES.PEOPLE.DETAIL(person.id))}
                  onGrantLogin={() => { this.grantConfirm = person; }} />
              ))}
            </div>
          )}
          <DataTablePagination totalDocs={filtered.length} limit={limit} page={currentPage} onPageChange={(p: number) => { this.page = p; }} />
        </div>

        <ConfirmDialog
          isOpen={!!grantConfirm}
          onClose={() => { this.grantConfirm = null; }}
          onConfirm={() => this.grantLogin()}
          isLoading={isGranting}
          title={AdminI18n.t('users.createLoginAccount2')}
          description={AdminI18n.t('users.thisCreatesALoginAccount', { email: grantConfirm?.email })}
          confirmLabel={AdminI18n.t('users.createAccount')}
        />
      </div>
    );
  }
}
