"use client";

import React, { ReactNode } from 'react';
import { PluginsProvider, Override, usePlugins, Slot } from '@fromcode/react';
import { useSystemStatus } from '../lib/useSystemStatus';
import MaintenanceScreen from '../components/MaintenanceScreen';
import ThemeInitializer from '../components/ThemeInitializer';

function SystemGate({ children }: { children: ReactNode }) {
  const status = useSystemStatus();
  const { themeLayouts } = usePlugins();

  if (status === 'LOADING') {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 10000 }} />;
  }

  if (status === 'MAINTENANCE') {
    return <MaintenanceScreen />;
  }

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

  return (
    <Override name="frontend.layout.main" fallback={content}>
      {children}
    </Override>
  );
}

export default function RootProvider({ children }: { children: ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';

  return (
    <PluginsProvider apiUrl={apiUrl}>
      <ThemeInitializer />
      <SystemGate>
        {children}
      </SystemGate>
    </PluginsProvider>
  );
}
