"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { AuthHooks } from '@/components/use-auth';
import { usePathname } from 'next/navigation';
import { NavUtils } from '@/lib/nav-utils';
import { AdminConstants } from '@/lib/constants';
import { AdminServices } from '@/lib/admin-services';
import { PlatformBrandingService } from '@/lib/platform-branding-service';
import { SidebarMenuService } from './services/sidebar-menu-service';
import { SidebarBrandHeader } from './sidebar-brand-header';
import { SidebarNavGroups } from './sidebar-nav-groups';
import { SidebarMiniToggle } from './sidebar-mini-toggle';
import { SidebarMobileSecondaryPanel } from './sidebar-mobile-secondary-panel';
import type { SidebarProps } from './sidebar.types';

const adminServices = AdminServices.getInstance();

export default function Sidebar(props: SidebarProps) {
  const { isOpen, onClose, isMini, onMiniToggle, onActiveContextChange, activeSecondaryAnchorPath, hoverPreviewPath, previewablePaths, onHoverPreviewPathChange, inlineSecondaryContext, inlineSecondaryItems, inlineSecondarySourceLabel, showInlineSecondary, activePrimaryPathOverride, activeChildPathOverride, onPreviewRegionEnter, onPreviewRegionLeave } = props;
  const { menuItems, plugins, settings } = ContextHooks.usePlugins();
  const { user } = AuthHooks.useAuth();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const platformName = React.useMemo(
    () => PlatformBrandingService.resolvePlatformName(settings as Record<string, unknown> | null | undefined),
    [settings]
  );
  const normalizedActivePrimaryPathOverride = React.useMemo(() => NavUtils.normalizePath(activePrimaryPathOverride), [activePrimaryPathOverride]);
  // Child-level active path (honours secondary-panel sourcePaths) — resolves to a CHILD route (e.g.
  // /mlm/programs) so a sub-page like /mlm/compensation-plans highlights the right child, not the
  // closest-prefix sibling. The primary override above stays group-level (e.g. /mlm) for expansion.
  const normalizedActiveChildPathOverride = React.useMemo(() => NavUtils.normalizePath(activeChildPathOverride), [activeChildPathOverride]);

  const [collapsedGroups, setCollapsedGroups] = React.useState<string[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Lock body scroll on mobile when sidebar is open so the page doesn't scroll
  // behind the overlay. On desktop the sidebar is always visible (lg:translate-x-0)
  // so isOpen is only ever true from the mobile burger button.
  React.useEffect(() => {
    if (!isOpen) return;
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;
    if (mq?.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Load state from localStorage on mount
  React.useEffect(() => {
    const saved = adminServices.uiPreference.readCollapsedSidebarGroups();
    if (saved.length) {
      setCollapsedGroups(saved);
    }
    setIsInitialized(true);
  }, []);

  // Save state to localStorage when it changes
  React.useEffect(() => {
    if (isInitialized) {
      adminServices.uiPreference.writeCollapsedSidebarGroups(collapsedGroups);
    }
  }, [collapsedGroups, isInitialized]);

  const authorizedMenuItems = SidebarMenuService.authorizeMenuItems(menuItems, user);

  const footerSettingsPath = React.useMemo(
    () => NavUtils.normalizePath(AdminConstants.ROUTES.SETTINGS.ROOT),
    []
  );
  const footerSettingsItem = React.useMemo(
    () => authorizedMenuItems.find((item) => NavUtils.normalizePath(item.path) === footerSettingsPath) || null,
    [authorizedMenuItems, footerSettingsPath]
  );
  const footerSettingsIsGroup = React.useMemo(
    () => Boolean(footerSettingsItem && 'isGroup' in footerSettingsItem && footerSettingsItem.isGroup),
    [footerSettingsItem]
  );
  const groupedMenuItems = React.useMemo(
    () => authorizedMenuItems.filter((item) => NavUtils.normalizePath(item.path) !== footerSettingsPath),
    [authorizedMenuItems, footerSettingsPath]
  );

  const { groupedMenu, groupLabels } = SidebarMenuService.buildGroupedMenu(groupedMenuItems);
  const sortedGroups = SidebarMenuService.sortGroups(groupedMenu);

  const activePrimaryContextId = React.useMemo(
    () => SidebarMenuService.resolvePrimaryContextId(authorizedMenuItems, pathname),
    [authorizedMenuItems, pathname]
  );

  React.useEffect(() => {
    onActiveContextChange?.(activePrimaryContextId);
  }, [activePrimaryContextId, onActiveContextChange]);

  const showMobileSecondaryPanel = Boolean(showInlineSecondary && !isMini && (inlineSecondaryItems || []).length > 0);

  return (
    <aside className={`fixed inset-y-0 left-0 z-[200] ${isMini ? 'w-[72px]' : showMobileSecondaryPanel ? 'w-full max-w-full' : 'w-64'} transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 bg-white border-slate-200 dark:bg-[#020617] dark:border-slate-800 ${showMobileSecondaryPanel ? 'border-r-0' : 'border-r'} flex ${showMobileSecondaryPanel ? 'flex-row lg:flex-col' : 'flex-col'} shadow-2xl lg:shadow-[12px_0_28px_-24px_rgba(15,23,42,0.28)] dark:lg:shadow-[12px_0_28px_-24px_rgba(2,6,23,0.9)] overflow-hidden group/sidebar`} onMouseEnter={onPreviewRegionEnter} onMouseLeave={onPreviewRegionLeave}>
      <div className={`min-w-0 ${showMobileSecondaryPanel ? 'w-[45%] max-w-[18rem] min-w-[15rem] border-r border-slate-200 dark:border-slate-800' : 'w-full flex-1 min-h-0'} flex flex-col bg-white dark:bg-[#020617]`}>
        <SidebarBrandHeader isMini={isMini} platformName={platformName} onClose={onClose} />

        <nav className={`flex-1 min-h-0 ${isMini ? 'px-2' : 'px-4'} py-2 overflow-y-auto overscroll-contain scrollbar-hide space-y-1 pb-32`}>
        <div className="pt-2">
           {!isMini && <Slot name="admin.layout.sidebar.top" />}
        </div>

        <SidebarNavGroups
          isMini={isMini}
          pathname={pathname}
          sortedGroups={sortedGroups}
          groupedMenu={groupedMenu}
          groupLabels={groupLabels}
          collapsedGroups={collapsedGroups}
          plugins={plugins}
          previewablePaths={previewablePaths}
          hoverPreviewPath={hoverPreviewPath}
          activeSecondaryAnchorPath={activeSecondaryAnchorPath}
          normalizedActivePrimaryPathOverride={normalizedActivePrimaryPathOverride}
          normalizedActiveChildPathOverride={normalizedActiveChildPathOverride}
          footerSettingsItem={footerSettingsItem}
          footerSettingsIsGroup={footerSettingsIsGroup}
          onClose={onClose}
          onHoverPreviewPathChange={onHoverPreviewPathChange}
        />

        <div className="mt-4">
           {!isMini && <Slot name="admin.layout.sidebar.bottom" />}
        </div>

        </nav>
      </div>

      {showMobileSecondaryPanel && (
        <SidebarMobileSecondaryPanel
          inlineSecondaryContext={inlineSecondaryContext}
          inlineSecondaryItems={inlineSecondaryItems}
          inlineSecondarySourceLabel={inlineSecondarySourceLabel}
          pathname={pathname}
          onClose={onClose}
        />
      )}

      {/* Mini Toggle Button */}
      <SidebarMiniToggle isMini={isMini} onMiniToggle={onMiniToggle} />
    </aside>
  );
}
