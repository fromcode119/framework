"use client";

import React from 'react';
import PluginLoader from './plugin-loader';
import Sidebar from './sidebar';
import SecondarySidebar from './secondary-sidebar';
import AdminExtensionLoader from './admin-extension-loader';
import ClientLayoutHeader from './client-layout-header';
import { FrameworkIcons } from '@/lib/icons';
import { Loader } from '@/components/ui/loader';
import { AdminConstants } from '@/lib/constants';
import { AuthUtils } from '@/lib/auth-utils';
import type { ClientLayoutChildrenProps } from './client-layout.types';
import { ClientLayoutAuthStateHooks } from './services/client-layout-auth-state-hooks';
import { ClientLayoutNavigationStateHooks } from './services/client-layout-navigation-state-hooks';

export default function ClientLayoutShell({ children }: ClientLayoutChildrenProps) {
  const authState = ClientLayoutAuthStateHooks.useState();
  const navigationState = ClientLayoutNavigationStateHooks.useState({
    normalizedPathname: authState.normalizedPathname,
    isMinimalPath: authState.isMinimalPath,
    isAuthPage: authState.isAuthPage,
    user: authState.user,
  });

  if (authState.user && !authState.isAuthPage && !authState.user.roles?.includes('admin')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="max-w-md space-y-6 p-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500 shadow-xl shadow-rose-500/10">
            <FrameworkIcons.Zap size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Access Restricted</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500">
              Your account <span className="font-bold text-indigo-500">{authState.user.email}</span> does not have the required admin privileges to access this console.
            </p>
          </div>
          <button
            onClick={() => {
              AuthUtils.purgeAuth();
              authState.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
            }}
            className="w-full rounded-2xl bg-slate-900 py-4 text-[11px] font-semibold tracking-wide text-white shadow-2xl transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-900"
          >
            Switch Account
          </button>
        </div>
      </div>
    );
  }

  if (authState.isInitialized === null || (authState.isAuthLoading && !authState.isAuthPage)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-[#020617]"><Loader label="Initializing Secure Session" /></div>;
  }

  if (!authState.user && !authState.isAuthPage) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-[#020617]"><Loader label="Forwarding to Authentication..." /></div>;
  }

  if (authState.isAuthPage) {
    return <div className="min-h-screen bg-slate-50 font-sans transition-colors duration-300 dark:bg-[#020617]">{children}</div>;
  }

  if (authState.isMinimalPath) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans transition-all duration-300 ease-in-out dark:bg-[#020617]">
        <AdminExtensionLoader />
        {navigationState.showSecondaryTrigger ? (
          <SecondarySidebar
            mode={navigationState.secondaryMode}
            context={navigationState.secondaryResolved.activeContext}
            items={navigationState.secondaryResolved.items}
            sourceLabel={navigationState.secondarySourceLabel}
            isOpen={navigationState.isSecondaryOpen}
            onOpen={() => navigationState.setSecondaryOpen(true)}
            onClose={() => navigationState.setSecondaryOpen(false)}
          />
        ) : null}
        <main className="flex min-h-screen flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans transition-all duration-300 ease-in-out dark:bg-[#020617] lg:flex-row" style={{ '--secondary-sidebar-width': `${AdminConstants.SECONDARY_SIDEBAR.WIDTH_PX}px` } as React.CSSProperties}>
      <PluginLoader />
      <AdminExtensionLoader />
      {navigationState.isSidebarOpen ? <div className="fixed inset-0 z-[150] animate-in bg-slate-900/50 backdrop-blur-sm duration-300 lg:hidden" onClick={() => navigationState.setSidebarOpen(false)} /> : null}
      <Sidebar
        isOpen={navigationState.isSidebarOpen}
        onClose={() => navigationState.setSidebarOpen(false)}
        isMini={navigationState.isMini}
        onMiniToggle={() => navigationState.setIsMini(!navigationState.isMini)}
        onActiveContextChange={navigationState.setActivePrimaryContextId}
        activeSecondaryAnchorPath={navigationState.activeSecondaryAnchorPath}
        hoverPreviewPath={navigationState.hoveredPrimaryPath}
        previewablePaths={navigationState.secondaryMode === 'desktop' && navigationState.isDesktopSecondaryOpen && navigationState.hasDesktopPreviewablePaths ? navigationState.previewablePrimaryPaths : []}
        onHoverPreviewPathChange={navigationState.secondaryMode === 'desktop' && navigationState.isDesktopSecondaryOpen && navigationState.hasDesktopPreviewablePaths ? navigationState.handleHoverPreviewPathChange : undefined}
        inlineSecondaryContext={navigationState.secondaryResolved.activeContext}
        inlineSecondaryItems={navigationState.secondaryResolved.items}
        inlineSecondarySourceLabel={navigationState.secondarySourceLabel}
        showInlineSecondary={navigationState.showSecondaryInlineInSidebar}
        activePrimaryPathOverride={String(navigationState.activePrimaryItem?.path || '')}
        onPreviewRegionEnter={navigationState.handleLeftNavigationMouseEnter}
        onPreviewRegionLeave={navigationState.handleLeftNavigationMouseLeave}
      />
      {navigationState.showCollapsedDesktopSecondaryHandle ? (
        <SecondarySidebar
          mode={navigationState.secondaryMode}
          context={navigationState.displayedSecondaryResolved.activeContext}
          items={navigationState.displayedSecondaryResolved.items}
          sourceLabel={navigationState.displayedSecondarySourceLabel}
          isOpen={navigationState.isDesktopSecondaryOpen}
          onOpen={() => navigationState.setDesktopSecondaryOpen(true)}
          onClose={() => navigationState.setDesktopSecondaryOpen(false)}
          onPanelMouseEnter={navigationState.handleSecondaryPanelMouseEnter}
          onPanelMouseLeave={navigationState.handleSecondaryPanelMouseLeave}
          onItemActivate={navigationState.handleSecondaryItemActivate}
          parentPrimaryPath={navigationState.displayedSecondaryPrimaryPath}
        />
      ) : null}
      {navigationState.showSecondaryTrigger ? (
        <SecondarySidebar
          mode={navigationState.secondaryMode}
          context={navigationState.secondaryResolved.activeContext}
          items={navigationState.secondaryResolved.items}
          sourceLabel={navigationState.secondarySourceLabel}
          isOpen={navigationState.showSecondaryOverlay}
          onOpen={() => navigationState.setSecondaryOpen(true)}
          onClose={() => navigationState.setSecondaryOpen(false)}
        />
      ) : null}
      <main className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip transition-all duration-300 ease-in-out" onMouseEnter={navigationState.handleMainContentMouseEnter}>
        <ClientLayoutHeader onMenuClick={() => navigationState.setSidebarOpen(true)} />
        <div className="flex flex-1 flex-col transition-all duration-300">{children}</div>
      </main>
    </div>
  );
}
