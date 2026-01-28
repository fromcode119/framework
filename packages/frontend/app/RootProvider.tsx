"use client";

import React, { ReactNode } from 'react';
import { PluginsProvider, Override } from '@fromcode/react';
import { useSystemStatus } from '../lib/useSystemStatus';
import MaintenanceScreen from '../components/MaintenanceScreen';
import ThemeInitializer from '../components/ThemeInitializer';

function SystemGate({ children }: { children: ReactNode }) {
  const status = useSystemStatus();

  if (status === 'LOADING') {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 10000 }} />;
  }

  if (status === 'MAINTENANCE') {
    return <MaintenanceScreen />;
  }

  return (
    <Override name="frontend.layout.main" fallback={<>{children}</>}>
      {children}
    </Override>
  );
}

export default function RootProvider({ children }: { children: ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.fromcode.local';

  return (
    <PluginsProvider apiUrl={apiUrl}>
      <ThemeInitializer />
      <SystemGate>
        {children}
      </SystemGate>
    </PluginsProvider>
  );
}
