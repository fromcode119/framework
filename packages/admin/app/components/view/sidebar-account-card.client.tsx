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
import { PlatformAccess } from '@/lib/tenants/platform-access';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AvatarSize } from '@/app/components/enums/avatar-size.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminConsoleLanguage } from '@/lib/i18n/admin-console-language';
import { SidebarLanguageItems } from '@/app/components/view/sidebar-language-items';
import { SidebarSiteItems } from '@/app/components/view/sidebar-site-items';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';
import { AdminSiteBinding } from '@/lib/admin-site-binding';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AppEnv } from '@/lib/env';
import { ThemeMode } from '@fromcode119/core/client';

/**
 * Who you are signed in as, at the foot of the sidebar — and the one menu of the console.
 *
 * Everything the top header used to hold lives here now: the site you are editing (named on the row
 * itself, so it is visible on every screen without opening anything), switching sites or stepping out
 * to the platform, the light/dark toggle and the assistant. The header is gone; only a phone keeps a
 * bar, for the button that opens this sidebar.
 */
export class SidebarAccountCard extends AdminComponent {
  @prop declare isMini?: boolean;

  /** The sites this account may enter. Empty on a single-tenant deployment, which hides the group. */
  @state private sites: TenantOption[] = [];
  @state private currentSite: string | null = null;
  @state private multiTenant = false;
  /** How the current workspace was opened — marks the right one of its two rows. */
  @state private mode = '';
  /** The reader's own console language ('' = the site's default) and what the site offers. */
  @state private personalLanguage = '';

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    void this.loadLanguage();
    // `noDedupe`: WHICH SITE YOU ARE ON must never come from AdminApi's GET memo — it changes every time
    // somebody switches or steps out, and a stale hit names a site the session has already left.
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE, { noDedupe: true }).catch(() => null);
    if (!this.mounted || !response) return;
    this.currentSite = response.current ?? null;
    this.mode = String(response.mode ?? '');
    AdminSiteBinding.record(this.currentSite);
    if (response.multiTenant !== true) return;
    this.multiTenant = true;
    this.sites = TenantOption.fromList(response.tenants);
  }

  private async loadLanguage(): Promise<void> {
    const { personal } = await AdminConsoleLanguage.current();
    if (this.mounted) this.personalLanguage = personal;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /**
   * Switching reloads the whole page, deliberately: the previous site's data must not linger in
   * memory behind a new tenant's chrome. A refusal is said out loud, with the server's reason.
   */
  private async enter(tenantId: string, mode?: string): Promise<void> {
    if (!tenantId || (tenantId === this.currentSite && !mode)) return;
    const failure = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, mode ? { tenantId, mode } : { tenantId })
      .then(() => null)
      .catch((error: unknown) => SidebarSiteItems.reasonFor(error));
    if (!failure) {
      window.location.reload();
      return;
    }
    this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.site.switch'), failure);
  }

  /** Step out of every site into the platform scope. */
  private async leave(): Promise<void> {
    if (this.currentSite === null) return;
    await TenantScopeClient.leaveAndReload();
  }

  /** The row's second line: the site being edited on a multi-site install, the role otherwise. */
  private get subtitle(): string {
    if (!this.multiTenant) return this.role;
    if (this.currentSite === null) return AdminI18n.t('shell.site.platform');
    return this.sites.find((site) => site.id === this.currentSite)?.label || this.role;
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

  private get canAddSite(): boolean {
    const user = this.auth.user;
    return Boolean(user?.roles?.includes('admin')) && PlatformAccess.canManagePlatform(user);
  }

  private get siteItems(): IDropdownItem[] {
    return SidebarSiteItems.build({
      tenants: this.sites,
      current: this.currentSite,
      mode: this.mode,
      multiTenant: this.multiTenant,
      storefrontHost: this.storefrontHost,
      canManagePlatform: this.canAddSite,
      onSelect: (tenantId, mode) => { void this.enter(tenantId, mode); },
      onLeave: () => { void this.leave(); },
      onAddSite: () => this.router.push(AdminConstants.ROUTES.SITES.ROOT),
    });
  }

  /** Light/dark and the assistant: about how you work, so they sit with you rather than with a page. */
  private get preferenceItems(): IDropdownItem[] {
    const dark = this.theme === ThemeMode.DARK;
    return [
      {
        label: AdminI18n.t(dark ? 'shell.account.lightMode' : 'shell.account.darkMode'),
        icon: dark ? <FrameworkIcons.Sun size={16} /> : <FrameworkIcons.Moon size={16} />,
        onClick: this.runtime.toggleTheme,
      },
      ...(AppEnv.AI_ENABLED ? [{
        label: AdminI18n.t('shell.assistant'),
        icon: <FrameworkIcons.Zap size={16} />,
        onClick: () => this.router.push(AdminConstants.ROUTES.MINIMAL),
      }] : []),
    ];
  }

  private get items(): IDropdownItem[] {
    const { user, logout } = this.auth;
    return [
      {
        label: AdminI18n.t('shell.account.profile'),
        icon: <FrameworkIcons.User size={16} />,
        onClick: () => user?.id && this.router.push(AdminConstants.ROUTES.USERS.DETAIL(user.id)),
      },
      ...(user?.roles?.includes('admin')
        ? [{
            label: AdminI18n.t('shell.account.certificates'),
            icon: <FrameworkIcons.Lock size={16} />,
            onClick: () => this.router.push(AdminConstants.ROUTES.CERTIFICATES.ROOT),
          }, {
            label: AdminI18n.t('shell.account.systemSettings'),
            icon: <FrameworkIcons.Settings size={16} />,
            onClick: () => this.router.push(AdminConstants.ROUTES.SETTINGS.ROOT),
          }]
        : []),
      ...this.preferenceItems,
      ...SidebarLanguageItems.build({
        personal: this.personalLanguage,
        ...AdminConsoleLanguage.site(this.runtime?.globalSettings),
        onError: (message) => this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.account.language'), message),
      }),
      ...this.siteItems,
      {
        label: AdminI18n.t('shell.account.signOut'),
        icon: <FrameworkIcons.Logout size={16} />,
        onClick: logout,
        variant: DropdownItemVariant.DANGER,
      },
    ];
  }

  private avatar(size: AvatarSize): ReactElement {
    const box = size === AvatarSize.SMALL ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-[13px]';
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
        {this.avatar(AvatarSize.MEDIUM)}
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
        <span className="flex justify-center py-1" title={this.auth.user?.email || AdminI18n.t('shell.account.account')}>
          {this.avatar(AvatarSize.SMALL)}
        </span>
      );
    }

    return (
      <span className="group/account flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70">
        {this.avatar(AvatarSize.SMALL)}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12.5px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {this.displayName}
          </span>
          {this.subtitle ? (
            <span className={`truncate text-[10.5px] leading-tight text-slate-400 ${this.multiTenant ? '' : 'capitalize'}`}>{this.subtitle}</span>
          ) : null}
        </span>
        {/*
          * The SELECTOR affordance, not an arrow and not a single caret.
          *
          * `Up` was a navigation/upload glyph. A lone `ChevronUp` was better but still asserts a
          * direction, and this row does not go up — it opens a list of accounts and sites to choose
          * from. The paired chevrons are what every switcher of this shape uses, and they claim
          * nothing about where you are headed.
          */}
        <FrameworkIcons.ChevronsUpDown
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
