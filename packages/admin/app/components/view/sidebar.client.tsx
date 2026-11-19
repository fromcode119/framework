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
import { CommandPalette } from '@/components/ui/view/command-palette.client';
import { AdminNavText } from '@/lib/i18n/admin-nav-text';
import { SidebarSearch } from '@/app/sidebar-search.client';
import { NavShortcuts } from '@/lib/nav-shortcuts';

export class Sidebar extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare isMini: boolean;
  @prop declare onMiniToggle: () => void;
  @prop declare onActiveContextChange: (contextId: string) => void;
  /** The panel entries of the section you are in, drawn under that section in the menu. */
  @prop declare sectionPages: any[];
  /** Settings' own pages, whatever page is open: they open in the column beside the menu. */
  @prop declare settingsPages: any[];
  @prop declare activePrimaryPathOverride: string;
  @prop declare activeChildPathOverride: string;

  /** What the menu's search holds. */
  @state query = '';
  @state private paletteOpen = false;
  @state private paletteQuery = '';

  @bound private openPalette(): void { this.paletteQuery = ''; this.paletteOpen = true; }
  @bound private closePalette(): void { this.paletteOpen = false; }
  @bound private setPaletteQuery(query: string): void { this.paletteQuery = query; }

  /** Every page of the menu, sections and their pages alike, narrowed by what is typed in the big search. */
  private get palettePages(): Array<{ id: string; label: string; hint?: string; onSelect: () => void }> {
    const needle = this.paletteQuery.trim().toLocaleLowerCase();
    const seen = new Set<string>();
    const rows: Array<{ id: string; label: string; hint?: string; onSelect: () => void }> = [];
    const add = (item: any, parent?: any): void => {
      const path = NavUtils.normalizePath(item?.path);
      const label = AdminNavText.menuLabel(item);
      if (!path || seen.has(path) || !label.toLocaleLowerCase().includes(needle)) return;
      seen.add(path);
      rows.push({ id: path, label, hint: parent ? AdminNavText.menuLabel(parent) : undefined, onSelect: () => { this.closePalette(); this.router.push(path); } });
    };
    for (const item of [...this.groupedMenuItems, this.footerSettingsItem].filter(Boolean)) {
      add(item);
      for (const child of item.children || []) add(child, item);
    }
    return rows;
  }

  @bound private setQuery(query: string): void {
    this.query = query;
  }

  /** Previous `document.body.style.overflow` while the mobile scroll lock is engaged. */
  private lockedBodyOverflow: string | null = null;
  private lastNotifiedContextId: string | null = null;

  componentDidMount(): void {
    this.syncBodyScrollLock();
    this.notifyActiveContext();
    if (Platform.isBrowser) window.addEventListener('keydown', this.navigateByKey);
  }

  componentDidUpdate(prevProps: Record<string, unknown>): void {
    if (prevProps.isOpen !== this.isOpen) this.syncBodyScrollLock();
    this.notifyActiveContext();
  }

  componentWillUnmount(): void {
    this.releaseBodyScrollLock();
    if (Platform.isBrowser) window.removeEventListener('keydown', this.navigateByKey);
    window.clearTimeout(this.leaderTimer);
  }

  /** Whether G was pressed just now, so the next letter is a section rather than a letter of a word. */
  private leaderArmed = false;
  private leaderTimer = 0;

  /**
   * G, then a section's letter. The leader is forgotten after a moment, so a G pressed by accident
   * never swallows the key after it; anything typed into a field is the operator's and passes through.
   */
  @bound private navigateByKey(event: globalThis.KeyboardEvent): void {
    if (NavShortcuts.isTyping(event.target, event)) return;
    if (this.leaderArmed) {
      this.disarmLeader();
      const path = NavShortcuts.pathFor(this.shortcuts, event.code);
      if (!path) return;
      event.preventDefault();
      this.router.push(path);
      return;
    }
    if (event.code !== NavShortcuts.LEADER) return;
    event.preventDefault();
    this.leaderArmed = true;
    this.leaderTimer = window.setTimeout(() => { this.leaderArmed = false; }, NavShortcuts.WINDOW_MS);
  }

  private disarmLeader(): void {
    window.clearTimeout(this.leaderTimer);
    this.leaderArmed = false;
  }

  /** The letter each section of the menu answers to, derived from the menu the operator actually has. */
  private get shortcuts(): Map<string, string> {
    return NavShortcuts.assign([...this.groupedMenuItems, this.footerSettingsItem].filter(Boolean));
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
      settingsPages: this.settingsPages,
      normalizedActivePrimaryPathOverride: this.normalizedActivePrimaryPathOverride,
      normalizedActiveChildPathOverride: this.normalizedActiveChildPathOverride,
      footerSettingsItem: this.footerSettingsItem,
      onClose: this.onClose,
      query: isMini ? '' : this.query,
      shortcuts: this.shortcuts,
    };

    return (
      <aside className={`fc-nav fixed inset-y-0 start-0 z-[200] ${isMini ? 'w-14' : 'w-60'} transform ${this.isOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0'} transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col overflow-hidden`}>
        <SidebarBrandHeader isMini={isMini} platformName={this.platformName} onClose={this.onClose}
          notifications={<SidebarNotifications isMini compact />} />
        {!isMini && <SidebarSearch query={this.query} onQuery={this.setQuery} onPalette={this.openPalette} />}
        <CommandPalette open={this.paletteOpen} onClose={this.closePalette} query={this.paletteQuery} onQuery={this.setPaletteQuery} items={this.palettePages}
          placeholder={AdminI18n.t('shell.nav.search')} empty={AdminI18n.t('shell.nav.noMatches', { query: this.paletteQuery })} />

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
