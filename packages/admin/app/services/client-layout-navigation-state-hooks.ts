import React from 'react';

import { NavUtils } from '@/lib/nav-utils';
import { SecondarySidebarStateService } from '@/app/services/secondary-sidebar-state-service';
import { SecondarySidebarMode } from '@/app/services/enums/secondary-sidebar-mode.enum';
import { SecondarySidebarContextResolver } from '@/app/services/secondary-sidebar-context-resolver';
import { ClientLayoutSidebarStateHooks } from '@/app/services/client-layout-sidebar-state-hooks';

export class ClientLayoutNavigationStateHooks {
  private static readonly secondarySidebarStateService = new SecondarySidebarStateService();
  private static readonly secondarySidebarContextResolver = new SecondarySidebarContextResolver();

  static useState(args: { normalizedPathname: string; isMinimalPath: boolean; isAuthPage: boolean; user: any }) {
    const sidebarState = ClientLayoutSidebarStateHooks.useState(args);
    const [activePrimaryContextId, setActivePrimaryContextId] = React.useState('');
    const [hoveredPrimaryPath, setHoveredPrimaryPath] = React.useState('');
    const [previewPinned, setPreviewPinned] = React.useState(false);
    const [secondaryPrimaryOverride, setSecondaryPrimaryOverride] = React.useState<{ targetPath: string; parentPath: string } | null>(null);
    const hoverPreviewClearTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const secondaryMode = React.useMemo(() => {
      if (args.isMinimalPath) {
        return SecondarySidebarMode.MINIMAL;
      }
      return ClientLayoutNavigationStateHooks.secondarySidebarStateService.resolveMode({ viewportWidth: sidebarState.viewportWidth, isMini: sidebarState.isMini });
    }, [args.isMinimalPath, sidebarState.isMini, sidebarState.viewportWidth]);

    const secondaryResolved = React.useMemo(() => {
      return ClientLayoutNavigationStateHooks.secondarySidebarContextResolver.resolve({
        pathname: args.normalizedPathname,
        primaryContextId: activePrimaryContextId,
        menuItems: sidebarState.menuItems,
        secondaryPanel: sidebarState.effectiveSecondaryPanel,
        plugins: sidebarState.plugins,
        userRoles: args.user?.roles || [],
        userCapabilities: args.user?.permissions || [],
      });
    }, [args.normalizedPathname, activePrimaryContextId, sidebarState.menuItems, sidebarState.effectiveSecondaryPanel, sidebarState.plugins, args.user]);

    const routePrimaryItem = React.useMemo(() => NavUtils.resolveBestMatchEntry(args.normalizedPathname, sidebarState.menuItems), [sidebarState.menuItems, args.normalizedPathname]);
    const activePrimaryItem = React.useMemo(() => {
      const normalizedPath = NavUtils.normalizePath(args.normalizedPathname);
      const overrideTargetPath = NavUtils.normalizePath(secondaryPrimaryOverride?.targetPath || '');
      const overrideParentPath = NavUtils.normalizePath(secondaryPrimaryOverride?.parentPath || '');
      const resolvedSourcePath = NavUtils.normalizePath(secondaryResolved.activeSourcePath);

      if (!normalizedPath || !overrideTargetPath || !overrideParentPath || !NavUtils.isPathMatch(normalizedPath, overrideTargetPath)) {
        return resolvedSourcePath
          ? (sidebarState.menuItems || []).find((item) => NavUtils.normalizePath(item?.path) === resolvedSourcePath) || routePrimaryItem
          : routePrimaryItem;
      }

      return (sidebarState.menuItems || []).find((item) => NavUtils.normalizePath(item?.path) === overrideParentPath) || routePrimaryItem;
    }, [args.normalizedPathname, sidebarState.menuItems, routePrimaryItem, secondaryPrimaryOverride, secondaryResolved.activeSourcePath]);

    const previewablePrimaryPaths = React.useMemo(() => {
      const result: string[] = [];

      for (const item of sidebarState.menuItems || []) {
        const itemPath = NavUtils.normalizePath(item?.path);
        if (!itemPath) {
          continue;
        }

        const resolved = ClientLayoutNavigationStateHooks.secondarySidebarContextResolver.resolve({
          pathname: itemPath,
          primaryContextId: String(item?.pluginSlug || ''),
          menuItems: sidebarState.menuItems,
          secondaryPanel: sidebarState.effectiveSecondaryPanel,
          plugins: sidebarState.plugins,
          userRoles: args.user?.roles || [],
          userCapabilities: args.user?.permissions || [],
        });

        if (resolved.items.length > 0) {
          result.push(itemPath);
        }
      }

      return result;
    }, [sidebarState.menuItems, sidebarState.effectiveSecondaryPanel, sidebarState.plugins, args.user]);

    const hoveredPrimaryItem = React.useMemo(() => {
      const normalizedHoveredPath = NavUtils.normalizePath(hoveredPrimaryPath);
      if (!normalizedHoveredPath) {
        return null;
      }

      return (sidebarState.menuItems || []).find((item) => NavUtils.normalizePath(item?.path) === normalizedHoveredPath) || null;
    }, [hoveredPrimaryPath, sidebarState.menuItems]);

    const hoveredSecondaryResolved = React.useMemo(() => {
      const normalizedHoveredPath = NavUtils.normalizePath(hoveredPrimaryPath);
      if (!normalizedHoveredPath || secondaryMode !== SecondarySidebarMode.DESKTOP || !hoveredPrimaryItem) {
        return null;
      }

      const resolved = ClientLayoutNavigationStateHooks.secondarySidebarContextResolver.resolve({
        pathname: normalizedHoveredPath,
        primaryContextId: String(hoveredPrimaryItem?.pluginSlug || ''),
        menuItems: sidebarState.menuItems,
        secondaryPanel: sidebarState.effectiveSecondaryPanel,
        plugins: sidebarState.plugins,
        userRoles: args.user?.roles || [],
        userCapabilities: args.user?.permissions || [],
      });

      return resolved.items.length > 0 ? resolved : null;
    }, [hoveredPrimaryPath, secondaryMode, hoveredPrimaryItem, sidebarState.menuItems, sidebarState.effectiveSecondaryPanel, sidebarState.plugins, args.user]);

    const activePreviewPath = React.useMemo(() => NavUtils.normalizePath(hoveredPrimaryPath), [hoveredPrimaryPath]);
    const secondarySourceLabel = React.useMemo(() => {
      const primaryLabel = String(activePrimaryItem?.label || '').trim();
      return primaryLabel || String(secondaryResolved.activeContext?.label || '').trim();
    }, [activePrimaryItem, secondaryResolved.activeContext]);

    const hasSecondaryItems = secondaryResolved.items.length > 0;
    const displayedSecondaryResolved = activePreviewPath && hoveredSecondaryResolved ? hoveredSecondaryResolved : secondaryResolved;
    const displayedSecondarySourceLabel = activePreviewPath && hoveredSecondaryResolved
      ? String(hoveredPrimaryItem?.label || '').trim() || secondarySourceLabel
      : secondarySourceLabel;
    const displayedSecondaryPrimaryPath = activePreviewPath && hoveredSecondaryResolved
      ? String(hoveredPrimaryItem?.path || '')
      : String(activePrimaryItem?.path || '');
    const hasDisplayedSecondaryItems = displayedSecondaryResolved.items.length > 0;
    const hasDesktopPreviewablePaths = previewablePrimaryPaths.length > 0;
    // True when the displayed secondary is driven by a HOVER (not docked open) —
    // the panel should then float as an overlay instead of reserving layout width.
    const isDesktopSecondaryHoverPreview = secondaryMode === SecondarySidebarMode.DESKTOP
      && !sidebarState.isDesktopSecondaryOpen
      && Boolean(activePreviewPath && hoveredSecondaryResolved);
    const activeSecondaryAnchorPath = hasSecondaryItems ? String(activePrimaryItem?.path || '') : '';
    const showSecondaryTrigger = ClientLayoutNavigationStateHooks.secondarySidebarStateService.shouldShowTrigger(secondaryMode, hasSecondaryItems);
    const showSecondaryOverlay = ClientLayoutNavigationStateHooks.secondarySidebarStateService.shouldShowOverlay(secondaryMode, hasSecondaryItems, sidebarState.isSecondaryOpen);
    const showSecondaryInlineInSidebar = secondaryMode === SecondarySidebarMode.MOBILE && hasSecondaryItems;
    const showCollapsedDesktopSecondaryHandle = secondaryMode === SecondarySidebarMode.DESKTOP && hasDisplayedSecondaryItems;

    React.useEffect(() => {
      if (!hasSecondaryItems) {
        sidebarState.setSecondaryOpen(false);
      }
    }, [hasSecondaryItems, sidebarState.setSecondaryOpen]);

    React.useEffect(() => {
      if (secondaryMode !== SecondarySidebarMode.DESKTOP) {
        setHoveredPrimaryPath('');
        setPreviewPinned(false);
      }
    }, [secondaryMode]);

    React.useEffect(() => {
      if (ClientLayoutNavigationStateHooks.secondarySidebarStateService.shouldCloseOnRouteChange(secondaryMode)) {
        sidebarState.setSecondaryOpen(false);
      }
      setHoveredPrimaryPath('');
      setPreviewPinned(false);
    }, [args.normalizedPathname, secondaryMode, sidebarState.setSecondaryOpen]);

    React.useEffect(() => {
      if (hoverPreviewClearTimeoutRef.current) {
        clearTimeout(hoverPreviewClearTimeoutRef.current);
        hoverPreviewClearTimeoutRef.current = null;
      }

      return () => {
        if (hoverPreviewClearTimeoutRef.current) {
          clearTimeout(hoverPreviewClearTimeoutRef.current);
        }
      };
    }, []);

    const clearHoveredPreview = React.useCallback(() => {
      if (!previewPinned) {
        setHoveredPrimaryPath('');
      }
    }, [previewPinned]);
    const scheduleHoveredPreviewClear = React.useCallback(() => {
      if (hoverPreviewClearTimeoutRef.current) {
        clearTimeout(hoverPreviewClearTimeoutRef.current);
      }

      hoverPreviewClearTimeoutRef.current = setTimeout(clearHoveredPreview, 180);
    }, [clearHoveredPreview]);
    const handleHoverPreviewPathChange = React.useCallback((path: string) => {
      const normalizedPath = NavUtils.normalizePath(path);
      if (hoverPreviewClearTimeoutRef.current) {
        clearTimeout(hoverPreviewClearTimeoutRef.current);
        hoverPreviewClearTimeoutRef.current = null;
      }

      if (!normalizedPath) {
        scheduleHoveredPreviewClear();
        return;
      }

      setPreviewPinned(false);
      setHoveredPrimaryPath(normalizedPath);
    }, [scheduleHoveredPreviewClear]);

    const handleSecondaryPanelMouseEnter = React.useCallback(() => {
      if (!activePreviewPath) {
        return;
      }

      if (hoverPreviewClearTimeoutRef.current) {
        clearTimeout(hoverPreviewClearTimeoutRef.current);
        hoverPreviewClearTimeoutRef.current = null;
      }
      setPreviewPinned(true);
    }, [activePreviewPath]);
    const handleSecondaryPanelMouseLeave = React.useCallback(() => {
      setPreviewPinned(false);
      scheduleHoveredPreviewClear();
    }, [scheduleHoveredPreviewClear]);
    const handleLeftNavigationMouseEnter = React.useCallback(() => {
      if (hoverPreviewClearTimeoutRef.current) {
        clearTimeout(hoverPreviewClearTimeoutRef.current);
        hoverPreviewClearTimeoutRef.current = null;
      }
    }, []);
    const handleLeftNavigationMouseLeave = React.useCallback(() => {
      setPreviewPinned(false);
      scheduleHoveredPreviewClear();
    }, [scheduleHoveredPreviewClear]);
    const handleMainContentMouseEnter = React.useCallback(() => {
      setPreviewPinned(false);
      setHoveredPrimaryPath('');
      if (hoverPreviewClearTimeoutRef.current) {
        clearTimeout(hoverPreviewClearTimeoutRef.current);
        hoverPreviewClearTimeoutRef.current = null;
      }
    }, []);
    const handleSecondaryItemActivate = React.useCallback((item?: any) => {
      const normalizedPreviewPath = NavUtils.normalizePath(displayedSecondaryPrimaryPath);
      const normalizedItemPath = NavUtils.normalizePath(String(item?.path || ''));
      if (normalizedPreviewPath && normalizedItemPath) {
        setSecondaryPrimaryOverride({ targetPath: normalizedItemPath, parentPath: normalizedPreviewPath });
      }

      setHoveredPrimaryPath('');
      setPreviewPinned(false);
    }, [displayedSecondaryPrimaryPath]);

    return {
      isSidebarOpen: sidebarState.isSidebarOpen,
      setSidebarOpen: sidebarState.setSidebarOpen,
      isSecondaryOpen: sidebarState.isSecondaryOpen,
      setSecondaryOpen: sidebarState.setSecondaryOpen,
      isDesktopSecondaryOpen: sidebarState.isDesktopSecondaryOpen,
      setDesktopSecondaryOpen: sidebarState.setDesktopSecondaryOpen,
      setActivePrimaryContextId,
      secondaryResolved,
      secondaryMode,
      secondarySourceLabel,
      activePrimaryItem,
      activeSecondaryAnchorPath,
      hoveredPrimaryPath,
      previewablePrimaryPaths,
      showSecondaryInlineInSidebar,
      showCollapsedDesktopSecondaryHandle,
      isDesktopSecondaryHoverPreview,
      showSecondaryTrigger,
      showSecondaryOverlay,
      hasDesktopPreviewablePaths,
      displayedSecondaryResolved,
      displayedSecondarySourceLabel,
      displayedSecondaryPrimaryPath,
      isMini: sidebarState.isMini,
      setIsMini: sidebarState.setIsMini,
      handleHoverPreviewPathChange,
      handleSecondaryPanelMouseEnter,
      handleSecondaryPanelMouseLeave,
      handleLeftNavigationMouseEnter,
      handleLeftNavigationMouseLeave,
      handleMainContentMouseEnter,
      handleSecondaryItemActivate,
    };
  }
}
