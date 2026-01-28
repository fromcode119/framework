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
import { ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/Loader';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { addNotification } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, any>>({
    platform_name: '',
    maintenance_mode: false,
    two_factor_enabled: false,
    email_notifications: true,
    rate_limit_max: '100',
    rate_limit_window: '900000'
  });

  // Fetch current settings on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`);
        const docs = response.docs || [];
        
        const newSettings = { ...settings };
        docs.forEach((s: any) => {
          if (s.key === 'maintenance_mode' || s.key === 'two_factor_enabled' || s.key === 'email_notifications') {
            newSettings[s.key] = s.value === 'true';
          } else {
            newSettings[s.key] = s.value;
          }
        });
        setSettings(newSettings);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Synchronizing Environment..." />
      </div>
    );
  }

  const updateSetting = async (key: string, value: any) => {
    // Update local state for immediate UI feedback
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Save immediately to API
    try {
      await api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/${key}`, {
        value: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
      });
      addNotification({
        title: 'Settings Updated',
        message: `${key.replace(/_/g, ' ')} has been updated.`,
        type: 'success'
      });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err.message || 'Failed to save setting.',
        type: 'error'
      });
      // Revert local state on failure
      const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`);
      const docs = response.docs || [];
      const original = docs.find((s: any) => s.key === key);
      if (original) {
        setSettings(prev => ({ ...prev, [key]: original.value === 'true' }));
      }
    }
  };

  const handleSave = async () => {
    // This button now serves as a global refresh/force save if needed, 
    // but toggles are already immediate.
    setIsSaving(true);
    try {
      await Promise.all(Object.entries(settings).map(([key, value]) => {
        return api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/${key}`, {
          value: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
        });
      }));
      
      addNotification({
        title: 'All Settings Saved',
        message: 'Global configuration synced successfully.',
        type: 'success'
      });
    } catch (err: any) {
      addNotification({
        title: 'Save Failed',
        message: err.message || 'An error occurred while saving settings.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const SettingRow = ({ icon: Icon, title, description, children }: any) => (
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

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      {/* Premium Settings Header */}
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Settings size={20} strokeWidth={2.5} />
                </div>
                <h1 className={`text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  System Settings
                </h1>
              </div>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Configure global platform behavior and identity protocols.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                className="px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all text-white" 
                icon={<FrameworkIcons.Save size={16} strokeWidth={2.5} />}
                onClick={handleSave}
                isLoading={isSaving}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Slot name="admin.settings.top" />
              
              <Card title="General Configuration">
                <SettingRow 
                  icon={FrameworkIcons.Zap} 
                  title="Platform Name" 
                  description="The public identifier for your portal and administrative interface."
                >
                  <Input 
                    value={settings.platform_name}
                    onChange={(e) => updateSetting('platform_name', e.target.value)}
                    className="w-full md:w-64"
                    placeholder="e.g. My Website"
                  />
                </SettingRow>

                <SettingRow 
                  icon={FrameworkIcons.Palette} 
                  title="Visual Core" 
                  description="Choose the visual style of your administration panel. Toggle between high-contrast modes."
                >
                  <div className={`flex p-1 rounded-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800 shadow-inner' : 'bg-slate-100/80 border border-slate-100 shadow-inner'}`}>
                    <button 
                      onClick={() => theme === 'dark' && toggleTheme()}
                      className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${theme === 'light' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <FrameworkIcons.Sun size={14} />
                      Light
                    </button>
                    <button 
                      onClick={() => theme === 'light' && toggleTheme()}
                      className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-indigo-600'}`}
                    >
                      <FrameworkIcons.Moon size={14} />
                      Dark
                    </button>
                  </div>
                </SettingRow>

                <SettingRow 
                  icon={FrameworkIcons.Shield} 
                  title="Two-Factor Security" 
                  description="Add an extra layer of security to your admin account by requiring verification codes."
                >
                  <Switch 
                    checked={settings.two_factor_enabled} 
                    onChange={(val) => updateSetting('two_factor_enabled', val)} 
                  />
                </SettingRow>

                <Slot name="admin.settings.general.after" />
              </Card>

              <Card title="Engagement">
                <SettingRow 
                  icon={FrameworkIcons.Mail} 
                  title="Email Telemetry" 
                  description="Receive critical system alerts, weekly summaries and audit snapshots via email."
                >
                  <Switch 
                    checked={settings.email_notifications} 
                    onChange={(val) => updateSetting('email_notifications', val)} 
                  />
                </SettingRow>

                <SettingRow 
                  icon={FrameworkIcons.Smartphone} 
                  title="Infrastructure Health" 
                  description="Enable real-time environment notifications via native OS push alerts."
                >
                  <Switch checked={false} onChange={() => {}} disabled label="Premium" />
                </SettingRow>
              </Card>

              <Card title="Security & API">
                <SettingRow 
                  icon={FrameworkIcons.Shield} 
                  title="Rate Limit (Max Requests)" 
                  description="The maximum number of requests a single IP can make within the defined window."
                >
                  <Input 
                    type="number"
                    value={settings.rate_limit_max}
                    onChange={(e) => updateSetting('rate_limit_max', e.target.value)}
                    className="w-full md:w-32"
                  />
                </SettingRow>

                <SettingRow 
                  icon={FrameworkIcons.Clock} 
                  title="Rate Limit Window" 
                  description="The time window in milliseconds for the rate limit (e.g., 900000 for 15 minutes)."
                >
                  <Input 
                    type="number"
                    value={settings.rate_limit_window}
                    onChange={(e) => updateSetting('rate_limit_window', e.target.value)}
                    className="w-full md:w-48"
                  />
                </SettingRow>
              </Card>

              <Slot name="admin.settings.bottom" />
            </div>

            <div className="space-y-8">
              <Slot name="admin.settings.sidebar.top" />
              <Card title="Infrastructure">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Database</span>
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      Healthy
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>API Clusters</span>
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Storage Used</span>
                    <span className="text-[11px] font-black text-slate-400">12.4 GB / 100 GB</span>
                  </div>
                  <div className={`-mx-8 -mb-8 mt-8 p-8 border-t transition-colors ${
                    theme === 'dark' 
                      ? 'bg-slate-950/50 border-slate-800/50' 
                      : 'bg-slate-50/50 border-slate-100'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-black uppercase tracking-widest text-indigo-500`}>Maintenance Mode</span>
                      <Switch 
                        checked={settings.maintenance_mode} 
                        onChange={(val) => updateSetting('maintenance_mode', val)} 
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
                      Restricts portal frontend access to administrative accounts only during system upgrades.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-rose-100/50 dark:border-rose-500/10 shadow-rose-500/5">
                <h3 className="text-xl font-black uppercase tracking-tight text-rose-500 mb-6 flex items-center gap-2">
                  <FrameworkIcons.Zap size={20} className="fill-current" />
                  Danger Zone
                </h3>
                <div className="space-y-4">
                  <p className="text-[11px] font-medium text-slate-500 italic leading-relaxed mb-4">Destructive operations affect global environment state.</p>
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
        </div>
      </div>

      {/* Premium Footer */}
      <div className={`mt-auto border-t ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Administrative Instance // Secure Mode
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 italic">Global configuration changes are logged and audited in real-time.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                className="rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-800"
                onClick={() => window.open('https://docs.fromcode.com', '_blank')}
              >
                Config Docs
              </Button>
              <Button 
                className="rounded-xl px-6 py-2.5 shadow-lg shadow-indigo-600/10 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-white"
                onClick={handleSave}
                isLoading={isSaving}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
