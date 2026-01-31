"use client";

import React, { useState, useEffect } from 'react';
import { Slot } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { usePlugins } from '@fromcode/react';
import { ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/Loader';

const SettingRow = ({ icon: Icon, title, description, children, theme }: any) => (
  <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
    <div className="flex gap-4">
      <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
        <Icon size={20} />
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

export default function GeneralSettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { addNotification } = useNotification();
  const { registerSettings } = usePlugins();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, any>>({
    platform_name: '',
    email_notifications: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`);
        const docs = response.docs || [];
        const newSettings = { ...settings };
        docs.forEach((s: any) => {
          if (s.key === 'platform_name' || s.key === 'email_notifications') {
            newSettings[s.key] = s.key === 'email_notifications' ? s.value === 'true' : s.value;
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

      // Update global context
      registerSettings(settings);
      
      addNotification({
        title: 'Settings Saved',
        message: 'Global configuration updated successfully.',
        type: 'success'
      });
    } catch (err: any) {
      addNotification({
        title: 'Save Failed',
        message: 'Could not sync settings with infrastructure.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-12"><Loader label="Collecting Global Metadata..." /></div>;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Sub-Page Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div>
          <h1 className={`text-xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            General Configuration
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
            Brand Identity & System preferences
          </p>
        </div>
        <Button 
          icon={<FrameworkIcons.Save size={14} strokeWidth={3} />}
          onClick={handleSave}
          isLoading={isSaving}
          className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
        >
          Save Changes
        </Button>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8">
        <Card title="Brand & Identity">
          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Zap} 
            title="Platform Name" 
            description="The public identifier for your portal and administrative interface."
          >
            <Input 
              value={settings.platform_name}
              onChange={(e) => setSettings(prev => ({ ...prev, platform_name: e.target.value }))}
              className="w-full md:w-64"
              placeholder="e.g. My Website"
            />
          </SettingRow>

          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Palette} 
            title="Visual Core" 
            description="Choose the visual style of your administration panel."
          >
            <div className={`flex p-1 rounded-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800 shadow-inner' : 'bg-slate-100/80 border border-slate-100 shadow-inner'}`}>
              <button onClick={() => theme === 'dark' && toggleTheme()} className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${theme === 'light' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-300'}`}>
                <FrameworkIcons.Sun size={14} /> Light
              </button>
              <button onClick={() => theme === 'light' && toggleTheme()} className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-indigo-600'}`}>
                <FrameworkIcons.Moon size={14} /> Dark
              </button>
            </div>
          </SettingRow>
        </Card>

        <Card title="Notifications">
          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Mail} 
            title="Email Telemetry" 
            description="Receive critical system alerts and weekly summaries via email."
          >
            <Switch 
              checked={settings.email_notifications} 
              onChange={(val) => setSettings(prev => ({ ...prev, email_notifications: val }))} 
            />
          </SettingRow>
        </Card>

        <Slot name="admin.settings.general.bottom" />
      </div>
    </div>
  );
}
