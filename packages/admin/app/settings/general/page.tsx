"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Slot } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { NotificationHooks } from '@/components/use-notification';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { SettingsRegistrationService } from '@/lib/settings/settings-registration-service';
import { TimezoneUtils } from '@/lib/timezone';
import { GeneralBrandCard } from './general-brand-card';
import { GeneralSystemCards } from './general-system-cards';

export default function GeneralSettingsPage() {
  const { theme, toggleTheme } = ThemeHooks.useTheme();
  const { addNotification } = NotificationHooks.useNotification();
  const { registerSettings } = SettingsRegistrationService.useRegistration('general-settings-page', 'GeneralSettingsPage');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTelemetryTest, setIsSendingTelemetryTest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, any>>({
    platform_name: '',
    email_notifications: true,
    notification_email: '',
    notification_email_cc: '',
    frontend_url: '',
    admin_url: '',
    site_url: '',
    marketplace_url: '',
    domain_aliases: [] as string[],
    timezone: 'UTC',
    frontend_auth_enabled: true,
    frontend_registration_enabled: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const newSettings = { ...settings };
        const response = await AdminSystemSettingsClient.getAll();
        Object.entries(response || {}).forEach(([key, value]) => {
          if (key === 'domain_aliases') {
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              newSettings['domain_aliases'] = Array.isArray(parsed) ? parsed : [];
            } catch {
              newSettings['domain_aliases'] = [];
            }
          } else if (settings.hasOwnProperty(key)) {
            newSettings[key] = ['email_notifications', 'frontend_auth_enabled', 'frontend_registration_enabled'].includes(key)
              ? value === true || value === 'true'
              : value;
          }
        });
        setSettings(newSettings);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const timezoneOptions = useMemo(
    () => TimezoneUtils.getTimezoneOptions(String(settings.timezone ?? '').trim()),
    [settings.timezone]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await AdminSystemSettingsClient.update({
          platform_name: String(settings.platform_name ?? '').trim(),
          email_notifications: Boolean(settings.email_notifications),
          notification_email: String(settings.notification_email ?? '').trim(),
          notification_email_cc: String(settings.notification_email_cc ?? '').trim(),
          frontend_url: String(settings.frontend_url ?? '').trim(),
          admin_url: String(settings.admin_url ?? '').trim(),
          site_url: String(settings.site_url ?? '').trim(),
          marketplace_url: String(settings.marketplace_url ?? '').trim(),
          domain_aliases: JSON.stringify(Array.isArray(settings.domain_aliases) ? settings.domain_aliases : []),
          timezone: String(settings.timezone ?? '').trim(),
          frontend_auth_enabled: Boolean(settings.frontend_auth_enabled),
        frontend_registration_enabled: Boolean(settings.frontend_registration_enabled),
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
        <GeneralBrandCard
          settings={settings}
          setSettings={setSettings}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <GeneralSystemCards
          settings={settings}
          setSettings={setSettings}
          theme={theme}
          timezoneOptions={timezoneOptions}
          isSendingTelemetryTest={isSendingTelemetryTest}
          onSendTelemetryTest={handleSendTelemetryTest}
        />

        <Slot name="admin.settings.general.bottom" />
      </div>
    </div>
  );
}
