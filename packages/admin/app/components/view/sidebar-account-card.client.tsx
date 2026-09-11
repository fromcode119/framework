import type { ReactElement } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';

/**
 * Who you are signed in as, at the foot of the sidebar — and the only place the account menu lives.
 *
 * It used to sit in the top-right header. Down here it is beside the navigation it belongs to, it
 * survives the sidebar collapsing, and the header keeps only what is about the SYSTEM rather than
 * about you: which site is being edited, whether the api answers, the theme toggle.
 */
export class SidebarAccountCard extends AdminComponent {
  @prop declare isMini?: boolean;

  /** The sites this account may enter. Empty on a single-tenant deployment, which hides the group. */
  @state private sites: Array<Record<string, any>> = [];
  @state private currentSite = '';

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE).catch(() => null);
    if (!this.mounted || !response || response.multiTenant !== true) return;
    this.sites = Array.isArray(response.tenants) ? response.tenants : [];
    this.currentSite = String(response.current ?? '');
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /**
   * Switching reloads the whole page, deliberately: the previous site's data must not linger in
   * memory behind a new tenant's chrome. Same call the header switcher makes.
   */
  private async enter(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === this.currentSite) return;
    const ok = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId })
      .then(() => true)
      .catch(() => false);
    if (ok) window.location.reload();
  }

  private get initial(): string {
    return this.auth.user?.email?.charAt(0).toUpperCase() || '?';
  }

  private get displayName(): string {
    return this.auth.user?.email?.split('@')[0] || '';
  }

  private get role(): string {
    return String(this.auth.user?.roles?.[0] ?? '');
  }

  /**
   * The sites group, and the way into it.
   *
   * A single-site deployment has no site RECORDS at all — multi-tenancy switches on only once
   * `_system_tenants` has rows — so there is nothing to list and nothing to switch between. Inventing
   * one row for "the site you are on" would be a name no admin field produced. What is true in both
   * modes is that the Sites screen is where sites are added, so that row is always here; the
   * switchable list appears above it exactly when there is something to switch to.
   */
  private get siteItems(): IDropdownItem[] {
    const switcher = this.sites.map((site, index) => ({
      label: String(site.name || site.slug || site.id),
      detail: String(site.primaryHost || site.host || ''),
      section: index === 0 ? 'Sites' : undefined,
      selected: String(site.id) === this.currentSite,
      onClick: () => { void this.enter(String(site.id)); },
    }));

    return [
      ...switcher,
      {
        label: this.sites.length > 0 ? 'Manage sites' : 'Add a site',
        detail: this.sites.length > 0 ? undefined : 'Serving one site — add a second to switch between them',
        section: switcher.length === 0 ? 'Sites' : undefined,
        icon: <FrameworkIcons.Globe size={16} />,
        onClick: () => this.router.push(AdminConstants.ROUTES.SITES.ROOT),
      },
    ];
  }

  private get items(): IDropdownItem[] {
    const { user, logout } = this.auth;
    return [
      {
        label: 'View profile',
        icon: <FrameworkIcons.User size={16} />,
        onClick: () => user?.id && this.router.push(AdminConstants.ROUTES.USERS.DETAIL(user.id)),
      },
      ...(user?.roles?.includes('admin')
        ? [{
            label: 'System settings',
            icon: <FrameworkIcons.Settings size={16} />,
            onClick: () => this.router.push(AdminConstants.ROUTES.SETTINGS.ROOT),
          }]
        : []),
      {
        label: 'Documentation',
        icon: <FrameworkIcons.Help size={16} />,
        onClick: () => window.open(AdminConstants.FRAMEWORK_RESOURCES.DOCS, '_blank', 'noopener'),
      },
      ...this.siteItems,
      {
        label: 'Sign out',
        icon: <FrameworkIcons.Logout size={16} />,
        onClick: logout,
        variant: DropdownItemVariant.DANGER,
      },
    ];
  }

  private avatar(size: 'sm' | 'md'): ReactElement {
    const box = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-[13px]';
    return (
      <span
        className={`${box} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white ring-1 ring-inset ring-white/15`}
      >
        {this.initial}
      </span>
    );
  }

  /** The same identity the trigger shows, repeated at the top of the menu so the menu stands alone. */
  private get menuHeader(): ReactElement {
    return (
      <div className="flex items-center gap-3">
        {this.avatar('md')}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">
            {this.displayName}
          </span>
          <span className="truncate text-[11.5px] leading-tight text-slate-500 dark:text-slate-400">
            {this.auth.user?.email}
          </span>
        </div>
      </div>
    );
  }

  private get trigger(): ReactElement {
    if (this.isMini) {
      return (
        <span className="flex justify-center py-1" title={this.auth.user?.email || 'Account'}>
          {this.avatar('sm')}
        </span>
      );
    }

    return (
      <span className="group/account flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70">
        {this.avatar('sm')}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12.5px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {this.displayName}
          </span>
          {this.role ? (
            <span className="truncate text-[10.5px] leading-tight text-slate-400 capitalize">{this.role}</span>
          ) : null}
        </span>
        <FrameworkIcons.Up
          size={14}
          className="shrink-0 text-slate-300 transition-colors group-hover/account:text-slate-500 dark:text-slate-600"
        />
      </span>
    );
  }

  render(): ReactElement {
    return (
      <div className={`border-t border-slate-200/80 dark:border-slate-800/80 ${this.isMini ? 'p-2' : 'p-2'}`}>
        <Dropdown align={HorizontalAlign.LEFT} items={this.items} trigger={this.trigger} header={this.menuHeader} />
      </div>
    );
  }
}
