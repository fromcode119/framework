"use client";

import React, { useState, useEffect } from 'react';
import { Slot } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@/lib/icons';
import { AdminApi } from '@/lib/api';
import { NotificationHooks } from '@/components/use-notification';
import { ContextHooks } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';

const SettingRow = ({ icon: Icon, title, description, children, theme }: any) => (
  <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
    <div className="flex gap-4">
      <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
        {Icon ? <Icon size={20} /> : <div className="w-5 h-5" />}
      </div>
      <div>
        <h3 className={`font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
        <p className="text-sm font-bold text-slate-500 mt-1 max-w-sm leading-relaxed opacity-70 tracking-tight">{description}</p>
      </div>
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

export default function GeneralSettingsPage() {
  const { theme, toggleTheme } = ThemeHooks.useTheme();
  const { addNotification } = NotificationHooks.useNotification();
  const { registerSettings } = ContextHooks.usePlugins();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTelemetryTest, setIsSendingTelemetryTest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingSettingKeys, setExistingSettingKeys] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, any>>({
    platform_name: '',
    email_notifications: true,
    frontend_url: '',
    timezone: 'UTC',
    frontend_auth_enabled: true,
    frontend_registration_enabled: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/settings`);
        const docs = response.docs || [];
        const newSettings = { ...settings };
        docs.forEach((s: any) => {
          if (settings.hasOwnProperty(s.key)) {
            newSettings[s.key] = ['email_notifications', 'frontend_auth_enabled', 'frontend_registration_enabled'].includes(s.key)
              ? s.value === 'true'
              : s.value;
          }
        });
        setExistingSettingKeys(new Set(docs.map((s: any) => String(s?.key || '').trim()).filter(Boolean)));
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
      const entries = Object.entries(settings).map(([key, value]) => {
        const serialized = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value ?? '').trim();
        return { key, serialized };
      });

      const upserts = entries
        .filter(({ serialized }) => serialized !== '')
        .map(({ key, serialized }) => {
          const payload = { value: serialized };
          if (existingSettingKeys.has(key)) {
            return AdminApi.put(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/settings/${encodeURIComponent(key)}`, payload);
          }
          return AdminApi.post(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/settings`, { key, ...payload });
        });

      await Promise.all(upserts);
      setExistingSettingKeys((prev) => {
        const next = new Set(prev);
        for (const { key, serialized } of entries) {
          if (serialized !== '') next.add(key);
        }
        return next;
      });

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

  const handleSendTelemetryTest = async () => {
    setIsSendingTelemetryTest(true);
    try {
      const result = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EMAIL_TELEMETRY_TEST, {});
      const recipientsCount = Number(result?.recipientsCount || 0);
      addNotification({
        title: 'Telemetry Test Sent',
        message: recipientsCount > 0
          ? `Test email dispatched to ${recipientsCount} recipient${recipientsCount === 1 ? '' : 's'}.`
          : 'Test email dispatched.',
        type: 'success'
      });
    } catch (err: any) {
      addNotification({
        title: 'Test Failed',
        message: err?.message || 'Failed to send telemetry test email.',
        type: 'error'
      });
    } finally {
      setIsSendingTelemetryTest(false);
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
          <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            General Configuration
          </h1>
          <p className="text-[10px] font-bold text-slate-500 tracking-tight uppercase opacity-60">
            Brand Identity & System preferences
          </p>
        </div>
        <Button 
          icon={<FrameworkIcons.Save size={14} strokeWidth={3} />}
          onClick={handleSave}
          isLoading={isSaving}
          className="px-6 h-11 rounded-xl font-bold uppercase tracking-tight text-[11px] shadow-lg shadow-indigo-600/10"
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
              className="w-full md:w-64 font-bold"
              placeholder="e.g. My Website"
            />
          </SettingRow>

          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Globe} 
            title="Frontend URL" 
            description="The base URL where your website is hosted. Used for previews and sitemaps."
          >
            <Input 
              value={settings.frontend_url}
              onChange={(e) => setSettings(prev => ({ ...prev, frontend_url: e.target.value }))}
              className="w-full md:w-64 font-bold"
              placeholder="https://example.com"
            />
          </SettingRow>

          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Palette} 
            title="Visual Core" 
            description="Choose the visual style of your administration panel."
          >
            <div className={`flex p-1 rounded-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800 shadow-inner' : 'bg-slate-100/80 border border-slate-100 shadow-inner'}`}>
              <button onClick={() => theme === 'dark' && toggleTheme()} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight rounded-xl transition-all ${theme === 'light' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-300'}`}>
                <FrameworkIcons.Sun size={14} /> Light
              </button>
              <button onClick={() => theme === 'light' && toggleTheme()} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight rounded-xl transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-indigo-600'}`}>
                <FrameworkIcons.Moon size={14} /> Dark
              </button>
            </div>
          </SettingRow>
        </Card>

        <Card title="Regional Defaults">
          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Clock} 
            title="System Timezone" 
            description="The default timezone for content scheduling and logging."
          >
            <select
              value={settings.timezone}
              onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
              className={`w-full md:w-64 h-11 rounded-xl py-2 px-4 outline-none border transition-all text-sm font-bold ${
                theme === 'dark' 
                  ? 'bg-slate-900 border-slate-800 text-white' 
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <option value="UTC">UTC (Universal Time)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Paris (CET/CEST)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </SettingRow>
        </Card>

        <Card title="Notifications">
          <SettingRow 
            theme={theme}
            icon={FrameworkIcons.Mail} 
            title="Email Telemetry" 
            description="Receive critical system alerts and weekly summaries via email."
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.email_notifications}
                onChange={(val) => setSettings(prev => ({ ...prev, email_notifications: val }))}
              />
              <Button
                onClick={handleSendTelemetryTest}
                isLoading={isSendingTelemetryTest}
                icon={<FrameworkIcons.Mail size={13} />}
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                Send Test
              </Button>
            </div>
          </SettingRow>
        </Card>

        <Card title="Frontend Auth">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Lock}
            title="Frontend Authentication"
            description="Enable public customer authentication routes such as register, verify email, forgot password and reset password."
          >
            <Switch
              checked={settings.frontend_auth_enabled}
              onChange={(val) =>
                setSettings((prev) => ({
                  ...prev,
                  frontend_auth_enabled: val,
                  frontend_registration_enabled: val ? prev.frontend_registration_enabled : false
                }))
              }
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Users}
            title="Frontend Registration"
            description="Allow new customer self-registration at /register."
          >
            <Switch
              checked={settings.frontend_registration_enabled}
              onChange={(val) => setSettings((prev) => ({ ...prev, frontend_registration_enabled: val }))}
              disabled={!settings.frontend_auth_enabled}
            />
          </SettingRow>
        </Card>

        <Slot name="admin.settings.general.bottom" />
      </div>
    </div>
  );
}
