"use client";

import React from 'react';
import { PluginsProvider } from '@fromcode119/react';
import { ThemeProvider } from '@/components/theme-context';
import * as SharedComponents from '@/components';
import { AdminConstants } from '@/lib/constants';
import type { ClientLayoutChildrenProps } from './client-layout.types';
import ClientLayoutShell from './client-layout-shell';
import { AdminThemeEntryScriptGuardService } from './services/admin-theme-entry-script-guard-service';
import { ClientLayoutRuntimeService } from './services/client-layout-runtime-service';

AdminThemeEntryScriptGuardService.install();

export default function ClientLayout({ children }: ClientLayoutChildrenProps) {
  const runtimeModules = React.useMemo(() => {
    const source = SharedComponents as Record<string, unknown>;
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
      <ThemeProvider>
        <ClientLayoutShell>{children}</ClientLayoutShell>
      </ThemeProvider>
    </PluginsProvider>
  );
}
