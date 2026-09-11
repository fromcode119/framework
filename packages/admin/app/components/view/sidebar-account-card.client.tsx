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
 * survives the sidebar collapsing (the avatar stays, the menu is unchanged), and the header keeps
 * only what is about the SYSTEM rather than about you: which site you are editing, whether the api
 * is answering, and the theme toggle.
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

  private get siteItems(): IDropdownItem[] {
    return this.sites.map((site, index) => ({
      label: String(site.name || site.slug || site.id),
      detail: String(site.primaryHost || site.host || ''),
      section: index === 0 ? 'Switch site' : undefined,
      selected: String(site.id) === this.currentSite,
      onClick: () => { void this.enter(String(site.id)); },
    }));
  }

  private get initial(): string {
    return this.auth.user?.email?.charAt(0).toUpperCase() || '?';
  }

  private get displayName(): string {
    return this.auth.user?.email?.split('@')[0] || '';
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

  private get avatar(): ReactElement {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 text-[11px] font-bold text-white">
        {this.initial}
      </div>
    );
  }

  private get trigger(): ReactElement {
    if (this.isMini) {
      return (
        <div className="flex justify-center py-1" title={this.auth.user?.email || 'Account'}>
          {this.avatar}
        </div>
      );
    }

    return (
      <div className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900">
        {this.avatar}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {this.displayName}
          </span>
          <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">{this.auth.user?.email}</span>
        </div>
        <FrameworkIcons.Down size={14} className="shrink-0 text-slate-400" />
      </div>
    );
  }

  /** The same identity the trigger shows, repeated at the top of the menu so the menu stands alone. */
  private get menuHeader(): ReactElement {
    return (
      <div className="flex items-center gap-2.5">
        {this.avatar}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">{this.displayName}</span>
          <span className="truncate text-[11px] text-slate-500">{this.auth.user?.email}</span>
        </div>
      </div>
    );
  }

  render(): ReactElement {
    return (
      <div className={`border-t border-slate-200 dark:border-slate-800 ${this.isMini ? 'px-2 py-2' : 'px-3 py-3'}`}>
        <Dropdown align={HorizontalAlign.LEFT} items={this.items} trigger={this.trigger} header={this.menuHeader} />
      </div>
    );
  }
}
