"use client";

import React, { ReactNode, useEffect } from 'react';
import { PluginsProvider, Override, usePlugins, Slot } from '@fromcode/react';
import { useRouter } from 'next/navigation';
import { useSystemStatus } from '../lib/use-system-status';
import MaintenanceScreen from '../components/maintenance-screen';
import ThemeInitializer from '../components/theme-initializer';

function SystemGate({ children }: { children: ReactNode }) {
  const status = useSystemStatus();
  const { themeLayouts } = usePlugins();

  // Use Theme's MainLayout if provided
  const MainLayout = themeLayouts?.['MainLayout'] || themeLayouts?.['StandardLayout'] || themeLayouts?.['AppLayout'];
  const content = MainLayout ? (
    <MainLayout>{children}</MainLayout>
  ) : (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] text-[var(--foreground)] p-4 text-center">
      <div className="max-w-7xl mx-auto w-full">
        {/* Default Slot placement if no theme layout exists */}
        <Slot name="frontend.home.hero" />
        <div className="mt-8">
          {children}
        </div>
      </div>
    </main>
  );

  if (status === 'MAINTENANCE') {
    return <MaintenanceScreen />;
  }

  return (
    <Override name="frontend.layout.main" fallback={content}>
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
        return;
      }
      router.push(href);
    };

    window.addEventListener('fromcode:navigate', onNavigate as EventListener);
    return () => {
      window.removeEventListener('fromcode:navigate', onNavigate as EventListener);
    };
  }, [router]);

  return null;
}

export default function RootProvider({ children }: { children: ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';

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
