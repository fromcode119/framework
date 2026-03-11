"use client";

import React, { useState, useEffect } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@/lib/icons';
import { AdminApi } from '@/lib/api';
import { NotificationHooks } from '@/components/use-notification';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';

export default function InfrastructureSettingsPage() {
  const { theme } = ThemeHooks.useTheme();
  const { addNotification } = NotificationHooks.useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await AdminApi.get(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS_BASE);
        const docs = response.docs || [];
        const found = docs.find((s: any) => s.key === 'maintenance_mode');
        if (found) setMaintenance(found.value === 'true');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const toggleMaintenance = async (val: boolean) => {
    setMaintenance(val);
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('maintenance_mode'), {
        value: val ? 'true' : 'false'
      });
      addNotification({ title: 'System Updated', message: `Maintenance mode is now ${val ? 'active' : 'inactive'}.`, type: 'info' });
    } catch {
      addNotification({ title: 'Error', message: 'Failed to toggle mode.', type: 'error' });
    }
  };

  if (isLoading) return <div className="p-12"><Loader label="Analyzing Cluster Health..." /></div>;

  return (
    <div className="p-8 lg:p-12 animate-in fade-in duration-500 max-w-5xl">
       <div className="mb-10">
        <h1 className={`text-3xl font-bold tracking-tighter mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Infrastructure & Health
        </h1>
        <p className="text-slate-500 font-medium text-sm tracking-tight opacity-70">
          Monitor system clusters and perform administrative maintenance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Pulse Monitor">
           <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Database</span>
                <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>API Clusters</span>
                <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1">
                  <span className={`text-xs font-semibold tracking-wide text-indigo-500`}>Maintenance Mode</span>
                  <p className="text-[10px] text-slate-400 font-medium">Restricts frontend access.</p>
                </div>
                <Switch checked={maintenance} onChange={toggleMaintenance} />
              </div>
           </div>
        </Card>

        <Card title="Danger Zone">
           <div className="space-y-4 py-4">
              <Button variant="ghost" className="w-full justify-between group border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl px-6 py-4" icon={<FrameworkIcons.Database size={18} />}>
                Flush Cache Clusters
                <FrameworkIcons.ArrowRight size={16} className="opacity-40 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="ghost" className="w-full justify-between group bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl px-6 py-4 dark:bg-rose-500/10 dark:border-rose-500/20" icon={<FrameworkIcons.Shield size={18} />}>
                Hard Factory Reset
                <FrameworkIcons.ArrowRight size={16} className="opacity-40 group-hover:translate-x-1 transition-transform" />
              </Button>
           </div>
        </Card>
      </div>
    </div>
  );
}
