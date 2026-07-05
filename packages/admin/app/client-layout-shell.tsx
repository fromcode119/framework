"use client";

import React from 'react';
import PluginLoader from './plugin-loader';
import Sidebar from './sidebar';
import SecondarySidebar from './secondary-sidebar';
import AdminExtensionLoader from './admin-extension-loader';
import { ClientLayoutHeader } from './client-layout-header';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';
import { AdminConstants } from '@/lib/constants';
import { AuthUtils } from '@/lib/auth-utils';
import { ApplicationUrlUtils, AppPathConstants } from '@fromcode119/core/client';
import type { ClientLayoutChildrenProps } from './client-layout.interfaces';
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

  // Admit admins AND scoped-staff users (anyone holding at least one admin-area permission). Users with
  // NO admin permissions (e.g. plain customers/partners) fall through to the self-service account view.
  // Backward-safe: sessions issued before permissions were baked lack `permissions`, so this reduces to
  // the prior admin-only check for them.
  const userPermissions = Array.isArray((authState.user as { permissions?: unknown } | null)?.permissions)
    ? ((authState.user as { permissions?: string[] }).permissions as string[])
    : [];
  const canAccessAdmin = !!authState.user?.roles?.includes('admin') || userPermissions.length > 0;

  if (authState.user && !authState.isAuthPage && !canAccessAdmin) {
    // No admin permissions — this account isn't staff, but it can still manage its own profile,
    // security and orders on the self-service account page (frontend). Send them there instead of a
    // dead-end. joinApiPath cleanly joins the (possibly empty) frontend base with the account path,
    // yielding a relative '/account' when the base is unresolved.
    const accountUrl = ApplicationUrlUtils.joinApiPath(
      ApplicationUrlUtils.inferBrowserBaseUrl('frontend'),
      AppPathConstants.FRONTEND.ACCOUNT,
    );
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="max-w-md space-y-6 p-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-500 shadow-xl shadow-indigo-500/10">
            <FrameworkIcons.User size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Your account</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500">
              You're signed in as <span className="font-bold text-indigo-500">{authState.user.email}</span>. This area is for staff — manage your own profile, security and activity from your account.
            </p>
          </div>
          <button
            onClick={() => { window.location.href = accountUrl; }}
            className="w-full rounded-2xl bg-slate-900 py-4 text-[11px] font-semibold tracking-wide text-white shadow-2xl transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-900"
          >
            Go to my account
          </button>
          <button
            onClick={() => {
              AuthUtils.purgeAuth();
              authState.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
            }}
            className="w-full text-[11px] font-semibold tracking-wide text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            Sign out
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
        previewablePaths={navigationState.secondaryMode === 'desktop' && navigationState.hasDesktopPreviewablePaths ? navigationState.previewablePrimaryPaths : []}
        onHoverPreviewPathChange={navigationState.secondaryMode === 'desktop' && navigationState.hasDesktopPreviewablePaths ? navigationState.handleHoverPreviewPathChange : undefined}
        inlineSecondaryContext={navigationState.secondaryResolved.activeContext}
        inlineSecondaryItems={navigationState.secondaryResolved.items}
        inlineSecondarySourceLabel={navigationState.secondarySourceLabel}
        showInlineSecondary={navigationState.showSecondaryInlineInSidebar}
        activePrimaryPathOverride={String(navigationState.activePrimaryItem?.path || '')}
        activeChildPathOverride={String(navigationState.secondaryResolved?.activeSourcePath || '')}
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
          hoverOpen={navigationState.isDesktopSecondaryHoverPreview}
          overlayLeftClass={navigationState.isMini ? 'left-[72px]' : 'left-64'}
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
