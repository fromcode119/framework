"use client";

import React, { useState, useEffect } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { NotificationHooks } from '@/components/use-notification';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';
import { SecurityDashboard } from './security-dashboard';
import { SecuritySettingsCards } from './security-settings-cards';
import { CompactPageHeader } from '@/components/ui/compact-page-header';

export default function SecuritySettingsPage() {
  const { theme } = ThemeHooks.useTheme();
  const { addNotification } = NotificationHooks.useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, any>>({
    two_factor_enabled: false,
    rate_limit_max: '100',
    rate_limit_window: '900000',
    auth_session_duration_minutes: '10080',
  });

  const fetchSettings = async () => {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS);
    setSettings((prev) => ({
      ...prev,
      two_factor_enabled: response.two_factor_enabled === 'true',
      rate_limit_max: response.rate_limit_max ?? prev.rate_limit_max,
      rate_limit_window: response.rate_limit_window ?? prev.rate_limit_window,
      auth_session_duration_minutes: response.auth_session_duration_minutes ?? prev.auth_session_duration_minutes,
    }));
  };

  const fetchStats = async () => {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.SECURITY);
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch security stats", e);
    }
  };

  useEffect(() => {
    const loadPageData = async () => {
      try {
        await fetchSettings();
        if (activeTab === 'dashboard') {
          await fetchStats();
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPageData();
  }, [activeTab]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, {
        two_factor_enabled: settings.two_factor_enabled ? 'true' : 'false',
        rate_limit_max: String(settings.rate_limit_max),
        rate_limit_window: String(settings.rate_limit_window),
        auth_session_duration_minutes: String(settings.auth_session_duration_minutes),
      });
      await fetchSettings();
      addNotification({ title: 'Security Updated', message: 'API protection and account defense synced.', type: 'success' });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err?.message || 'Failed to save security configuration.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-12"><Loader label="Hardening Protocols..." /></div>;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Shield size={18} strokeWidth={2} />}
        title="Security & Defense"
        subtitle="Runtime isolation and protection"
        actions={
          <>
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                Settings
              </button>
            </div>
            {activeTab === 'settings' && (
              <Button
                icon={<FrameworkIcons.Shield size={15} strokeWidth={2} />}
                onClick={handleSave}
                isLoading={isSaving}
                className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
              >
                Update Security
              </Button>
            )}
          </>
        }
      />

      <div className="p-6 w-full space-y-8 pb-24">
        {activeTab === 'dashboard' && stats && (
          <SecurityDashboard stats={stats} />
        )}

        {activeTab === 'settings' && (
          <SecuritySettingsCards settings={settings} setSettings={setSettings} theme={theme} />
        )}
      </div>
    </div>
  );
}
