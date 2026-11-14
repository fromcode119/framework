import type { ReactElement } from 'react';
import { SidebarNavPart } from '@/app/enums/sidebar-nav-part.enum';
import { Platform, bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons, Slot } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NavUtils } from '@/lib/nav-utils';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PlatformBrandingService } from '@/lib/platform-branding-service';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';
import { SidebarBrandHeader } from '@/app/sidebar-brand-header';
import { SidebarNavGroups } from '@/app/sidebar-nav-groups';
import { SidebarAccountCard } from '@/app/components/view/sidebar-account-card.client';
import { SidebarNotifications } from '@/app/components/view/sidebar-notifications.client';
import { SidebarMiniToggle } from '@/app/sidebar-mini-toggle';
import { SidebarSearch } from '@/app/sidebar-search.client';

export class Sidebar extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare isMini: boolean;
  @prop declare onMiniToggle: () => void;
  @prop declare onActiveContextChange: (contextId: string) => void;
  /** The panel entries of the section you are in, drawn under that section in the menu. */
  @prop declare sectionPages: any[];
  @prop declare activePrimaryPathOverride: string;
  @prop declare activeChildPathOverride: string;

  /** What the menu's search holds. */
  @state query = '';

  @bound private setQuery(query: string): void {
    this.query = query;
  }

  /** Previous `document.body.style.overflow` while the mobile scroll lock is engaged. */
  private lockedBodyOverflow: string | null = null;
  private lastNotifiedContextId: string | null = null;

  componentDidMount(): void {
    this.syncBodyScrollLock();
    this.notifyActiveContext();
  }

  componentDidUpdate(prevProps: Record<string, unknown>): void {
    if (prevProps.isOpen !== this.isOpen) this.syncBodyScrollLock();
    this.notifyActiveContext();
  }

  componentWillUnmount(): void {
    this.releaseBodyScrollLock();
  }

  // Lock body scroll on mobile when sidebar is open so the page doesn't scroll
  // behind the overlay. On desktop the sidebar is always visible (lg:translate-x-0)
  // so isOpen is only ever true from the mobile burger button.
  private syncBodyScrollLock(): void {
    if (!this.isOpen) {
      this.releaseBodyScrollLock();
      return;
    }
    if (this.lockedBodyOverflow !== null) return;
    const mq = Platform.isBrowser ? window.matchMedia('(min-width: 1024px)') : null;
    if (mq?.matches) return;
    this.lockedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private releaseBodyScrollLock(): void {
    if (this.lockedBodyOverflow === null) return;
    document.body.style.overflow = this.lockedBodyOverflow;
    this.lockedBodyOverflow = null;
  }

  private notifyActiveContext(): void {
    const contextId = this.activePrimaryContextId;
    if (contextId === this.lastNotifiedContextId) return;
    this.lastNotifiedContextId = contextId;
    this.onActiveContextChange?.(contextId);
  }

  private get pluginRuntime(): any {
    return this.runtime?.plugins ?? {};
  }

  private get pathnameValue(): string {
    return this.pathname || '';
  }

  private get platformName(): string {
    return PlatformBrandingService.resolvePlatformName(
      this.pluginRuntime.settings as Record<string, unknown> | null | undefined
    );
  }

  private get normalizedActivePrimaryPathOverride(): string {
    return NavUtils.normalizePath(this.activePrimaryPathOverride);
  }

  // Child-level active path (honours secondary-panel sourcePaths) — resolves to a CHILD route (e.g.
  // /<plugin>/<group>) so a sub-page like /<plugin>/<group>-detail highlights the right child, not the
  // closest-prefix sibling. The primary override above stays group-level (e.g. /<plugin>) for expansion.
  private get normalizedActiveChildPathOverride(): string {
    return NavUtils.normalizePath(this.activeChildPathOverride);
  }

  private get authorizedMenuItems(): any[] {
    return SidebarMenuService.authorizeMenuItems(this.pluginRuntime.menuItems, this.auth?.user);
  }

  private get footerSettingsPath(): string {
    return NavUtils.normalizePath(AdminConstants.ROUTES.SETTINGS.ROOT);
  }

  private get footerSettingsItem(): any {
    const path = this.footerSettingsPath;
    return this.authorizedMenuItems.find((item) => NavUtils.normalizePath(item.path) === path) || null;
  }

  private get groupedMenuItems(): any[] {
    const path = this.footerSettingsPath;
    return this.authorizedMenuItems.filter((item) => NavUtils.normalizePath(item.path) !== path);
  }

  private get activePrimaryContextId(): string {
    return SidebarMenuService.resolvePrimaryContextId(this.authorizedMenuItems, this.pathnameValue);
  }

  render(): ReactElement {
    // Open is the phone's drawer, opened from the menu button: it is always the full menu, whatever the
    // desktop's collapsed setting is.
    const isMini = this.isMini && !this.isOpen;
    const { groupedMenu } = SidebarMenuService.buildGroupedMenu(this.groupedMenuItems);
    const user = this.auth?.user;
    const navProps = {
      isAdmin: !!user?.roles?.includes('admin'),
      isMini,
      pathname: this.pathnameValue,
      groupedMenu,
      sectionPages: this.sectionPages,
      normalizedActivePrimaryPathOverride: this.normalizedActivePrimaryPathOverride,
      normalizedActiveChildPathOverride: this.normalizedActiveChildPathOverride,
      footerSettingsItem: this.footerSettingsItem,
      onClose: this.onClose,
      query: isMini ? '' : this.query,
    };

    return (
      <aside className={`fc-nav fixed inset-y-0 start-0 z-[200] ${isMini ? 'w-14' : 'w-60'} transform ${this.isOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0'} transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col overflow-hidden`}>
        <SidebarBrandHeader isMini={isMini} platformName={this.platformName} onClose={this.onClose}
          notifications={<SidebarNotifications isMini compact />} />
        {!isMini && <SidebarSearch query={this.query} onQuery={this.setQuery} />}

        <nav className={`fc-nav__scroll flex-1 min-h-0 ${isMini ? 'px-2' : 'px-3'} overflow-y-auto overscroll-contain scrollbar-hide`}>
          {!isMini && !this.query && <Slot name="admin.layout.sidebar.top" />}
          <SidebarNavGroups {...navProps} part={SidebarNavPart.MAIN} beforeSettings={!isMini ? <Slot name="admin.layout.sidebar.bottom" /> : null} />
        </nav>

        {/* The pinned foot of the sidebar: Settings, the account, and (collapsed) the way back out. */}
        <div className={`fc-nav__pinned mt-auto shrink-0 ${isMini ? 'px-2' : 'px-3'}`}>
          <SidebarNavGroups {...navProps} part={SidebarNavPart.FOOT} />
          {isMini ? null : (
            <button type="button" onClick={this.onMiniToggle} aria-label={AdminI18n.t('shell.nav.collapse')} title={AdminI18n.t('shell.nav.collapse')} className="fc-nav__collapse">
              <FrameworkIcons.Left size={16} />
            </button>
          )}
        </div>
        <div className="shrink-0">
          {isMini ? <SidebarNotifications isMini /> : null}
          <SidebarAccountCard isMini={isMini} />
          {isMini ? <SidebarMiniToggle isMini={isMini} onMiniToggle={this.onMiniToggle} /> : null}
        </div>
      </aside>
    );
  }
}
