"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/Loader';

const SettingRow = ({ icon: Icon, title, description, children, theme }: any) => (
  <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
    <div className="flex gap-4">
      <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
        {Icon ? <Icon size={20} /> : <div className="w-5 h-5" />}
      </div>
      <div>
        <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      </div>
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

export default function SecuritySettingsPage() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, any>>({
    two_factor_enabled: false,
    rate_limit_max: '100',
    rate_limit_window: '900000',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`);
        const docs = response.docs || [];
        const newSettings = { ...settings };
        docs.forEach((s: any) => {
          if (['two_factor_enabled', 'rate_limit_max', 'rate_limit_window'].includes(s.key)) {
            newSettings[s.key] = s.key === 'two_factor_enabled' ? s.value === 'true' : s.value;
          }
        });
        setSettings(newSettings);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all(Object.entries(settings).map(([key, value]) => {
        return api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/${key}`, {
          value: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
        });
      }));
      addNotification({ title: 'Security Updated', message: 'API protection and account defense synced.', type: 'success' });
    } catch (err) {
      addNotification({ title: 'Update Failed', message: 'Failed to save security configuration.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-12"><Loader label="Hardening Protocols..." /></div>;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Sub-Page Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div>
          <h1 className={`text-xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Security & Defense
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
            Access protocols and API enforcement
          </p>
        </div>
        <Button 
          icon={<FrameworkIcons.Shield size={14} strokeWidth={3} />}
          onClick={handleSave}
          isLoading={isSaving}
          className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
        >
          Update Security
        </Button>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8">
        <Card title="Account Defense">
          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.ShieldCheck} 
            title="Two-Factor Security" 
            description="Add an extra layer of security to administrative accounts."
          >
            <Switch 
              checked={settings.two_factor_enabled} 
              onChange={(val) => setSettings(prev => ({ ...prev, two_factor_enabled: val }))} 
            />
          </SettingRow>
        </Card>

        <Card title="API Firewall">
          <SettingRow 
             theme={theme}
            icon={FrameworkIcons.ShieldAlert} 
            title="Rate Limit (Max Requests)" 
            description="The maximum number of requests a single IP can make."
          >
            <Input 
              type="number"
              value={settings.rate_limit_max}
              onChange={(e) => setSettings(prev => ({ ...prev, rate_limit_max: e.target.value }))}
              className="w-full md:w-32"
            />
          </SettingRow>

          <SettingRow 
             theme={theme}
            icon={FrameworkIcons.Clock} 
            title="Rate Limit Window" 
            description="The time window in milliseconds (900000 = 15m)."
          >
            <Input 
              type="number"
              value={settings.rate_limit_window}
              onChange={(e) => setSettings(prev => ({ ...prev, rate_limit_window: e.target.value }))}
              className="w-full md:w-32"
            />
          </SettingRow>
        </Card>
      </div>
    </div>
  );
}
