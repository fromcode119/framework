"use client";

import React, { ReactNode } from 'react';
import { PluginsProvider } from '@fromcode/react';
import { useSystemStatus } from '../lib/useSystemStatus';
import MaintenanceScreen from '../components/MaintenanceScreen';

function SystemGate({ children }: { children: ReactNode }) {
  const status = useSystemStatus();

  if (status === 'LOADING') {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 10000 }} />;
  }

  if (status === 'MAINTENANCE') {
    return <MaintenanceScreen />;
  }

  return <>{children}</>;
}

export default function RootProvider({ children }: { children: ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';

  return (
    <PluginsProvider apiUrl={apiUrl}>
      <SystemGate>
        {children}
      </SystemGate>
    </PluginsProvider>
  );
}
