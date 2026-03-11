"use client";

import React, { ReactNode, useEffect } from 'react';
import { PluginsProvider, Override } from '@fromcode119/react';
import { useRouter } from 'next/navigation';
import { useSystemStatus } from '@/lib/use-system-status';
import MaintenanceScreen from '@/components/maintenance-screen';
import ThemeInitializer from '@/components/theme-initializer';
import { FrontendApiBaseUrl } from '@/lib/api-base-url';

function SystemGate({ children }: { children: ReactNode }) {
  const status = useSystemStatus();

  if (status === 'MAINTENANCE') {
    return <MaintenanceScreen />;
  }

  return (
    <Override name="frontend.layout.main" fallback={children}>
      {children}
    </Override>
  );
}

function RouterBridge() {
  const router = useRouter();

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ href?: string; replace?: boolean }>).detail;
      const href = String(detail?.href || '').trim();
      if (!href || href.startsWith('http') || !href.startsWith('/')) return;

      if (detail?.replace) {
        router.replace(href);
        router.refresh();
        return;
      }
      router.push(href);
      router.refresh();
    };

    window.addEventListener('fromcode:navigate', onNavigate as EventListener);
    return () => {
      window.removeEventListener('fromcode:navigate', onNavigate as EventListener);
    };
  }, [router]);

  return null;
}

export default function RootProvider({ children }: { children: ReactNode }) {
  const apiUrl = FrontendApiBaseUrl.resolveFrontendApiBaseUrl();

  return (
    <PluginsProvider apiUrl={apiUrl}>
      <RouterBridge />
      <ThemeInitializer />
      <SystemGate>
        {children}
      </SystemGate>
    </PluginsProvider>
  );
}
