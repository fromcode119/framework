"use client";

import React from 'react';
import { PluginsProvider, PluginRuntimeProvider } from '@fromcode119/react';
import { ThemeProvider } from '@/components/theme-context';
import { AdminRuntimeProvider } from '@/components/admin-runtime-provider';
import * as SharedComponents from '@/components';
import { AdminServices } from '@/lib/admin-services';
import { AdminConstants } from '@/lib/constants';
import type { ClientLayoutChildrenProps } from './client-layout.interfaces';
import AppearanceShellHostShim from './appearance-shell-host-shim';
import { AppearanceRuntimeLoader } from './appearance-runtime-loader';
import { AdminIconRegistryBootstrapService } from './services/admin-icon-registry-bootstrap-service';
import { AdminThemeEntryScriptGuardService } from './services/admin-theme-entry-script-guard-service';
import { ClientLayoutRuntimeService } from './services/client-layout-runtime-service';

AdminIconRegistryBootstrapService.install();
AdminThemeEntryScriptGuardService.install();

export default function ClientLayout({ children }: ClientLayoutChildrenProps) {
  const runtimeModules = React.useMemo(() => {
    // AdminServices lives in @/lib (not the @/components barrel), but plugins import it from
    // `@fromcode119/sdk/admin` (which re-exports it from `@fromcode119/admin/services`). Merge it
    // into the runtime source so the bridge exposes it on the admin runtime modules.
    const source = { ...(SharedComponents as Record<string, unknown>), AdminServices };
    const modules = ClientLayoutRuntimeService.buildRuntimeModules(source);
    ClientLayoutRuntimeService.seedWindowRuntimeModules(modules['@fromcode119/admin']);
    return modules;
  }, []);

  return (
    <PluginsProvider
      apiUrl={AdminConstants.API_BASE_URL}
      clientType="admin-ui"
      runtimeModules={runtimeModules}
    >
      <AppearanceRuntimeLoader>
        <ThemeProvider>
          <AdminRuntimeProvider>
            <PluginRuntimeProvider>
              <AppearanceShellHostShim>{children}</AppearanceShellHostShim>
            </PluginRuntimeProvider>
          </AdminRuntimeProvider>
        </ThemeProvider>
      </AppearanceRuntimeLoader>
    </PluginsProvider>
  );
}
