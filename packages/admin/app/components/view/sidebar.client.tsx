import type { ReactElement } from 'react';
import { Platform, prop, state, watch } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { NavUtils } from '@/lib/nav-utils';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminServices } from '@/lib/admin-services';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PlatformBrandingService } from '@/lib/platform-branding-service';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';
import { SidebarBrandHeader } from '@/app/sidebar-brand-header';
import { SidebarNavGroups } from '@/app/sidebar-nav-groups';
import { SidebarMiniToggle } from '@/app/sidebar-mini-toggle';
import { SidebarMobileSecondaryPanel } from '@/app/sidebar-mobile-secondary-panel';

export class Sidebar extends AdminComponent {
  private static readonly adminServices = AdminServices.getInstance();
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare isMini: boolean;
  @prop declare onMiniToggle: () => void;
  @prop declare onActiveContextChange: (contextId: string) => void;
  @prop declare activeSecondaryAnchorPath: string;
  @prop declare hoverPreviewPath: string;
  @prop declare previewablePaths: string[];
  @prop declare onHoverPreviewPathChange: (path: string) => void;
  @prop declare inlineSecondaryContext: any;
  @prop declare inlineSecondaryItems: any[];
  @prop declare inlineSecondarySourceLabel: string;
  @prop declare showInlineSecondary: boolean;
  @prop declare activePrimaryPathOverride: string;
  @prop declare activeChildPathOverride: string;
  @prop declare onPreviewRegionEnter: () => void;
  @prop declare onPreviewRegionLeave: () => void;

  @state collapsedGroups: string[] = [];
  @state isInitialized = false;

  /** Previous `document.body.style.overflow` while the mobile scroll lock is engaged. */
  private lockedBodyOverflow: string | null = null;
  private lastNotifiedContextId: string | null = null;

  componentDidMount(): void {
    this.syncBodyScrollLock();
    const saved = Sidebar.adminServices.uiPreference.readCollapsedSidebarGroups();
    if (saved.length) {
      this.collapsedGroups = saved;
    }
    this.isInitialized = true;
    this.notifyActiveContext();
  }

  componentDidUpdate(prevProps: Record<string, unknown>): void {
    if (prevProps.isOpen !== this.isOpen) this.syncBodyScrollLock();
    this.notifyActiveContext();
  }

  /** Persist the collapsed groups whenever they change (after the initial localStorage read). */
  @watch('collapsedGroups') persistCollapsedGroups(): void {
    if (!this.isInitialized) return;
    Sidebar.adminServices.uiPreference.writeCollapsedSidebarGroups(this.collapsedGroups);
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
  // /mlm/programs) so a sub-page like /mlm/compensation-plans highlights the right child, not the
  // closest-prefix sibling. The primary override above stays group-level (e.g. /mlm) for expansion.
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

  private get footerSettingsIsGroup(): boolean {
    const item = this.footerSettingsItem;
    return Boolean(item && 'isGroup' in item && item.isGroup);
  }

  private get groupedMenuItems(): any[] {
    const path = this.footerSettingsPath;
    return this.authorizedMenuItems.filter((item) => NavUtils.normalizePath(item.path) !== path);
  }

  private get activePrimaryContextId(): string {
    return SidebarMenuService.resolvePrimaryContextId(this.authorizedMenuItems, this.pathnameValue);
  }

  render(): ReactElement {
    const isMini = this.isMini;
    const isOpen = this.isOpen;
    const onClose = this.onClose;
    const pathname = this.pathnameValue;
    const { groupedMenu, groupLabels } = SidebarMenuService.buildGroupedMenu(this.groupedMenuItems);
    const sortedGroups = SidebarMenuService.sortGroups(groupedMenu);
    const user = this.auth?.user;
    const showMobileSecondaryPanel = Boolean(this.showInlineSecondary && !isMini && (this.inlineSecondaryItems || []).length > 0);

    return (
      <aside className={`fixed inset-y-0 left-0 z-[200] ${isMini ? 'w-[72px]' : showMobileSecondaryPanel ? 'w-full max-w-full' : 'w-64'} transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 bg-white border-slate-200 dark:bg-[#020617] dark:border-slate-800 ${showMobileSecondaryPanel ? 'border-r-0' : 'border-r'} flex ${showMobileSecondaryPanel ? 'flex-row lg:flex-col' : 'flex-col'} shadow-2xl lg:shadow-[12px_0_28px_-24px_rgba(15,23,42,0.28)] dark:lg:shadow-[12px_0_28px_-24px_rgba(2,6,23,0.9)] overflow-hidden group/sidebar`} onMouseEnter={this.onPreviewRegionEnter} onMouseLeave={this.onPreviewRegionLeave}>
        <div className={`min-w-0 ${showMobileSecondaryPanel ? 'w-[45%] max-w-[18rem] min-w-[15rem] border-r border-slate-200 dark:border-slate-800' : 'w-full flex-1 min-h-0'} flex flex-col bg-white dark:bg-[#020617]`}>
          <SidebarBrandHeader isMini={isMini} platformName={this.platformName} onClose={onClose} />

          <nav className={`flex-1 min-h-0 ${isMini ? 'px-2' : 'px-4'} py-2 overflow-y-auto overscroll-contain scrollbar-hide space-y-1 pb-32`}>
          <div className="pt-2">
             {!isMini && <Slot name="admin.layout.sidebar.top" />}
          </div>

          <SidebarNavGroups
            isAdmin={!!user?.roles?.includes('admin')}
            isMini={isMini}
            pathname={pathname}
            sortedGroups={sortedGroups}
            groupedMenu={groupedMenu}
            groupLabels={groupLabels}
            collapsedGroups={this.collapsedGroups}
            plugins={this.pluginRuntime.plugins}
            previewablePaths={this.previewablePaths}
            hoverPreviewPath={this.hoverPreviewPath}
            activeSecondaryAnchorPath={this.activeSecondaryAnchorPath}
            normalizedActivePrimaryPathOverride={this.normalizedActivePrimaryPathOverride}
            normalizedActiveChildPathOverride={this.normalizedActiveChildPathOverride}
            footerSettingsItem={this.footerSettingsItem}
            footerSettingsIsGroup={this.footerSettingsIsGroup}
            onClose={onClose}
            onHoverPreviewPathChange={this.onHoverPreviewPathChange}
          />

          <div className="mt-4">
             {!isMini && <Slot name="admin.layout.sidebar.bottom" />}
          </div>

          </nav>
        </div>

        {showMobileSecondaryPanel && (
          <SidebarMobileSecondaryPanel
            inlineSecondaryContext={this.inlineSecondaryContext}
            inlineSecondaryItems={this.inlineSecondaryItems}
            inlineSecondarySourceLabel={this.inlineSecondarySourceLabel}
            pathname={pathname}
            onClose={onClose}
          />
        )}

        {/* Mini Toggle Button */}
        <SidebarMiniToggle isMini={isMini} onMiniToggle={this.onMiniToggle} />
      </aside>
    );
  }
}
