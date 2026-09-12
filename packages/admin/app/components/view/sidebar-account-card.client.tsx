import type { ReactElement } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownPlacement } from '@/components/ui/enums/dropdown-placement.enum';
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
   * The site this deployment serves, whether or not it has a site RECORD.
   *
   * Multi-tenancy only switches on once `_system_tenants` has rows, so a single-site deployment has
   * no record to list — but it is still serving a host, and the storefront URL is a real configured
   * value rather than an invented one. Showing it answers "which site am I editing" in the one
   * place a person looks for that, and "Add a site" is the way to a second.
   */
  private get storefrontHost(): string {
    const base = ApplicationUrlUtils.inferBrowserBaseUrl('frontend');
    if (!base) return '';
    try {
      return new URL(base).host;
    } catch {
      return '';
    }
  }

  private get siteItems(): IDropdownItem[] {
    const switcher = this.sites.map((site) => ({
      label: String(site.name || site.slug || site.id),
      detail: String(site.primaryHost || site.host || ''),
      selectable: true,
      selected: String(site.id) === this.currentSite,
      onClick: () => { void this.enter(String(site.id)); },
    }));

    const single = switcher.length === 0 && this.storefrontHost
      ? [{
          label: this.storefrontHost,
          detail: 'The site this deployment serves',
          selectable: true,
          selected: true,
          onClick: () => { /* Already here — the row states which site you are editing. */ },
        }]
      : [];

    const rows = [...single, ...switcher];
    return [
      // `scrolls` bounds the site list in its own box. It grows with the installation — nine sites
      // already pushed "Add a site" and "Sign out" below the fold of their own menu — and the two
      // rows after it must stay reachable however many sites exist.
      ...rows.map((row, index) => ({ ...row, section: index === 0 ? 'Sites' : undefined, scrolls: index === 0 ? true : undefined })),
      {
        label: 'Add a site',
        icon: <FrameworkIcons.Plus size={16} />,
        section: rows.length === 0 ? 'Sites' : undefined,
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
        {/* A chevron, not an arrow. `Up` is a navigation/upload glyph and this row opens a menu —
            the caret is the affordance every other dropdown in the admin uses, and it points the way
            the menu actually opens (upward, from the foot of the sidebar). */}
        <FrameworkIcons.ChevronUp
          size={14}
          className="shrink-0 text-slate-300 transition-colors group-hover/account:text-slate-500 dark:text-slate-600"
        />
      </span>
    );
  }

  render(): ReactElement {
    return (
      <div className={`border-t border-slate-200/80 dark:border-slate-800/80 ${this.isMini ? 'p-2' : 'p-2'}`}>
        <Dropdown
          block
          placement={DropdownPlacement.BESIDE}
          align={HorizontalAlign.LEFT}
          items={this.items}
          trigger={this.trigger}
          header={this.menuHeader}
        />
      </div>
    );
  }
}
