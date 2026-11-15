import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTablePagination } from '@/components/ui/view/data-table-pagination.client';
import { AdminClass } from '@/lib/admin-class';
import { UsersRow } from '@/app/users/components/view/users-row.client';
import { Loader } from '@/components/ui/view/loader.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/react-class-components';
import { UsersRowActions } from '@/app/users/components/view/users-row-actions.client';
import { UsersPageHeader } from '@/app/users/components/view/users-page-header.client';
import type { IUser } from '@/app/users/interfaces/user.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { Input } from '@/components/ui/view/input.client';
import { UserListFilter } from '@/app/users/enums/user-list-filter.enum';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { AppPathConstants } from '@fromcode119/core/client';

export class UsersPage extends AdminComponent {
  private mounted = false;

  @state searchQuery = '';
  @state users: IUser[] = [];
  @state loading = true;
  /** role slug → the name the operator gave it under Roles; the list shows names, never slugs. */
  @state roleNames: Record<string, string> = {};
  @state deleteConfirm: IUser | null = null;
  @state isDeleting = false;
  /** Current page of the client-side user table. */
  @state page = 1;
  /** Set when the user list could not be loaded, so an empty table is never passed off as "no users". */
  @state loadError = '';

  private readonly pageSize = 20;

  /** Which of the counted tabs is open. */
  @state filter: UserListFilter = UserListFilter.ALL;

  componentDidMount(): void {
    this.mounted = true;
    void this.openTheListThisScopeHas();
  }

  /**
   * Inside a site, the list of everyone is People — the accounts list belongs to the platform and the
   * menu withholds it here. Reached by a link or a bookmark it would still have drawn the accounts,
   * so the one address lands on the list this scope actually has.
   */
  private async openTheListThisScopeHas(): Promise<void> {
    const locks = await PlatformSettingLocks.load().catch(() => null);
    if (!this.mounted) return;
    if (locks && !locks.isPlatformScope()) {
      this.router.replace(AppPathConstants.ADMIN.PEOPLE.ROOT);
      return;
    }
    void this.fetchUsers();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchUsers(): Promise<void> {
    try {
      const [response, roles] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES).catch(() => []),
      ]);
      const userData = response.docs || [];
      if (!this.mounted) return;
      this.roleNames = Object.fromEntries((Array.isArray(roles) ? roles : []).map((role: any) => [String(role?.slug ?? ''), String(role?.name ?? '').trim()]).filter(([slug, name]) => slug && name));
      this.loadError = '';

      this.users = userData;
    } catch (err) {
      console.error('Failed to fetch users:', err);
      // Without this the table fell back to "No user records match your query" — a positive claim
      // that the account list is empty, when in fact the request failed.
      if (this.mounted) this.loadError = err instanceof Error && err.message ? err.message : AdminI18n.t('users.theUserListCouldNot');
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async handleDelete(): Promise<void> {
    const deleteConfirm = this.deleteConfirm;
    if (!deleteConfirm) return;
    this.isDeleting = true;
    try {
      const result = await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.USER(deleteConfirm.id));
      // A person whose account is shared with another site is removed from THIS site, not deleted —
      // say so, rather than let the operator believe the account is gone.
      if (result?.removedFromSite) {
        this.runtime?.notify?.addNotification?.({ title: AdminI18n.t('users.users'), message: AdminI18n.t('users.removedFromSite'), type: NotificationType.INFO });
      }
      await this.fetchUsers();
      this.deleteConfirm = null;
    } finally {
      this.isDeleting = false;
    }
  }

  /** How many people each tab holds, before the search narrows them. */
  private countOf(filter: UserListFilter): number {
    return this.users.filter((u) => filter.matches(u)).length;
  }

  private get filteredUsers(): IUser[] {
    const filter = this.filter;
    const users = this.users.filter((u) => filter.matches(u));
    const searchQuery = this.searchQuery;
    return users.filter(u =>
      (u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()))
    );
  }

  /**
   * The table footer used to read "Showing 1-10 of N" while the body rendered ALL N rows, and every
   * page button called an undefined `onPageChange`. The slice below is what makes that footer true.
   * Clamped so a filter that shrinks the result set cannot strand the view on an empty page.
   */
  private get currentPage(): number {
    const totalPages = Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
    return Math.min(Math.max(1, this.page), totalPages);
  }

  private get pageItems(): IUser[] {
    const page = this.currentPage;
    return this.filteredUsers.slice((page - 1) * this.pageSize, page * this.pageSize);
  }


  render(): ReactElement {
    const theme = this.theme;
    const searchQuery = this.searchQuery;
    const loading = this.loading;
    const deleteConfirm = this.deleteConfirm;
    const isDeleting = this.isDeleting;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader label={AdminI18n.t('users.decryptingUserDatabase')} />
        </div>
      );
    }

    const pageItems = this.pageItems;
    return (
      <div className={`w-full flex flex-col animate-in fade-in duration-500 ${AdminClass.of('settings-page')}`}>
        <UsersPageHeader theme={theme} />

        <div className="w-full p-6">
          <div className={AdminClass.of('ext-tabbar')}>
            <nav className={AdminClass.of('ext-tabs')} aria-label={AdminI18n.t('users.users')}>
              {UserListFilter.all().map((filter) => (
                <button key={filter.value} type="button" className={AdminClass.of('ext-tabs__tab')}
                  aria-current={this.filter === filter ? 'page' : undefined}
                  onClick={() => { this.filter = filter; this.page = 1; }}>
                  {AdminI18n.t(`users.filter.${filter.value}`)}<span className={AdminClass.of('ext-tabs__count')}>{this.countOf(filter)}</span>
                </button>
              ))}
            </nav>
            <div className={AdminClass.of('ext-toolbar')}>
              <div className={AdminClass.of('ext-toolbar__search')}>
                <FrameworkIcons.Search size={16} />
                <Input
                  type="text"
                  placeholder={AdminI18n.t('users.searchUserBaseByName')}
                  value={searchQuery}
                  onChange={(e) => { this.searchQuery = e.target.value; this.page = 1; }}
                  inputClassName="ps-10"
                />
              </div>
            </div>
          </div>

          {pageItems.length === 0 ? (
            <div className={`${AdminClass.of('ext-list')} ${AdminClass.of('ext-empty')}`}>{this.loadError || AdminI18n.t('users.noUserRecordsMatchYour')}</div>
          ) : (
            <div className={AdminClass.of('ext-list')}>
              {pageItems.map((user) => (
                <UsersRow key={user.id} user={user} roleNames={this.roleNames} actions={
                  <UsersRowActions
                    user={user}
                    theme={theme}
                    onNavigate={(href) => this.router.push(href)}
                    onRequestDelete={(u) => { this.deleteConfirm = u; }}
                  />
                } />
              ))}
            </div>
          )}
          <DataTablePagination totalDocs={this.filteredUsers.length} limit={this.pageSize} page={this.currentPage} onPageChange={(p: number) => { this.page = p; }} />

          <Slot name="admin.users.list.bottom" />
        </div>

        <ConfirmDialog
          isOpen={!!deleteConfirm}
          onClose={() => { this.deleteConfirm = null; }}
          onConfirm={() => this.handleDelete()}
          isLoading={isDeleting}
          title={AdminI18n.t('users.revokeAccess')}
          description={AdminI18n.t('users.thisWillPermanentlyDeleteS', { email: deleteConfirm?.email })}
          confirmLabel={AdminI18n.t('users.deactivateUser')}
        />
      </div>
    );
  }
}
