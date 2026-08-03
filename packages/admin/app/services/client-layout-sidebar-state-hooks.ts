import React, { useLayoutEffect } from 'react';

import { Platform } from '@fromcode119/reactor';
import { ContextHooks } from '@fromcode119/react';
import { TimezoneUtils } from '@/lib/timezone';
import { AdminServices } from '@/lib/admin-services';
import { ClientLayoutPanelStateService } from '@/app/services/client-layout-panel-state-service';

export class ClientLayoutSidebarStateHooks {
  private static readonly adminServices = AdminServices.getInstance();

  static useState(args: { isAuthPage: boolean; user: any }) {
    const { loadConfig, settings, menuItems, plugins, secondaryPanel } = ContextHooks.usePlugins();
    const [, setTimezoneRenderVersion] = React.useState(0);
    const [isSidebarOpen, setSidebarOpen] = React.useState(false);
    const [isSecondaryOpen, setSecondaryOpen] = React.useState(false);
    const [isDesktopSecondaryOpen, setDesktopSecondaryOpen] = React.useState(() => {
      if (Platform.isBrowser) {
        return ClientLayoutSidebarStateHooks.adminServices.uiPreference.readSecondarySidebarDesktopOpen() !== false;
      }

      return true;
    });
    const [viewportWidth, setViewportWidth] = React.useState(0);
    const [isSidebarInitialized, setIsSidebarInitialized] = React.useState(false);
    const [metadataSecondaryPanel, setMetadataSecondaryPanel] = React.useState(ClientLayoutPanelStateService.createEmptyState());
    const [isMini, setIsMini] = React.useState(() => {
      if (Platform.isBrowser) {
        return ClientLayoutSidebarStateHooks.adminServices.uiPreference.readSidebarMini();
      }

      return false;
    });

    React.useEffect(() => {
      const saved = ClientLayoutSidebarStateHooks.adminServices.uiPreference.readSidebarOpen();
      if (saved !== null) {
        setSidebarOpen(saved);
      }
      setIsSidebarInitialized(true);
    }, []);

    React.useEffect(() => {
      if (isSidebarInitialized) {
        ClientLayoutSidebarStateHooks.adminServices.uiPreference.writeSidebarOpen(isSidebarOpen);
      }
    }, [isSidebarOpen, isSidebarInitialized]);

    React.useEffect(() => {
      if (!Platform.isBrowser) {
        return;
      }

      const syncViewport = () => setViewportWidth(window.innerWidth);
      syncViewport();
      window.addEventListener('resize', syncViewport);
      return () => window.removeEventListener('resize', syncViewport);
    }, []);

    React.useEffect(() => {
      if (!secondaryPanel || Object.keys(secondaryPanel.contexts || {}).length === 0) {
        return;
      }

      setMetadataSecondaryPanel(secondaryPanel);
    }, [secondaryPanel]);

    useLayoutEffect(() => {
      TimezoneUtils.applyDateLocaleTimezonePatch(String(settings?.timezone || ''));
      setTimezoneRenderVersion((value) => value + 1);
    }, [settings?.timezone]);

    React.useEffect(() => {
      ClientLayoutSidebarStateHooks.adminServices.uiPreference.writeSidebarMini(isMini);
    }, [isMini]);

    React.useEffect(() => {
      ClientLayoutSidebarStateHooks.adminServices.uiPreference.writeSecondarySidebarDesktopOpen(isDesktopSecondaryOpen);
    }, [isDesktopSecondaryOpen]);

    const effectiveSecondaryPanel = React.useMemo(() => {
      if (secondaryPanel && Object.keys(secondaryPanel.contexts || {}).length > 0) {
        return secondaryPanel;
      }

      return metadataSecondaryPanel;
    }, [metadataSecondaryPanel, secondaryPanel]);

    return {
      settings,
      menuItems,
      plugins,
      effectiveSecondaryPanel,
      viewportWidth,
      isSidebarOpen,
      setSidebarOpen,
      isSecondaryOpen,
      setSecondaryOpen,
      isDesktopSecondaryOpen,
      setDesktopSecondaryOpen,
      isMini,
      setIsMini,
    };
  }
}
