"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { NotificationHooks } from '@/components/use-notification';
import { Loader } from '@/components/ui/loader';
import { LocalizationSettingsIo } from './localization-settings-io';
import { SettingsRegistrationService } from '@/lib/settings/settings-registration-service';
import { LocaleRegistryCard } from './locale-registry-card';
import { LocaleTargetsCard } from './locale-targets-card';
import type { LocaleItem, LocaleUrlStrategy } from './localization.types';

const FALLBACK_LOCALES: LocaleItem[] = [
  { id: 'en', code: 'en', name: 'English', enabled: true }
];

export default function LocalizationSettingsPage() {
  const { theme } = ThemeHooks.useTheme();
  const { addNotification } = NotificationHooks.useNotification();
  const { registerSettings } = SettingsRegistrationService.useRegistration(
    'localization-settings-page',
    'LocalizationSettingsPage',
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [locales, setLocales] = useState<LocaleItem[]>(FALLBACK_LOCALES);
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [adminDefaultLocale, setAdminDefaultLocale] = useState('en');
  const [frontendDefaultLocale, setFrontendDefaultLocale] = useState('en');
  const [localeUrlStrategy, setLocaleUrlStrategy] = useState<LocaleUrlStrategy>('query');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const loaded = await LocalizationSettingsIo.load();
        setLocales(loaded.locales);
        setDefaultLocale(loaded.defaultLocale);
        setAdminDefaultLocale(loaded.adminDefaultLocale);
        setFrontendDefaultLocale(loaded.frontendDefaultLocale);
        setLocaleUrlStrategy(loaded.localeUrlStrategy);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const localeSelectOptions = useMemo(
    () => LocalizationSettingsIo.buildSelectOptions(locales),
    [locales]
  );

  const updateLocale = (id: string, patch: Partial<LocaleItem>) => {
    setLocales((prev) => prev.map((locale) => (locale.id === id ? { ...locale, ...patch } : locale)));
  };

  const addLocale = () => {
    const tempId = `locale-${Date.now()}`;
    setLocales((prev) => [
      ...prev,
      {
        id: tempId,
        code: '',
        name: '',
        enabled: true
      }
    ]);
  };

  const removeLocale = (id: string) => {
    setLocales((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((locale) => locale.id !== id);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleaned = LocalizationSettingsIo.cleanLocales(locales);

      if (!cleaned.length) {
        addNotification({
          title: 'Invalid Locale List',
          message: 'Add at least one locale with a valid ISO code.',
          type: 'error'
        });
        return;
      }

      const saved = await LocalizationSettingsIo.save(
        cleaned,
        { defaultLocale, adminDefaultLocale, frontendDefaultLocale },
        localeUrlStrategy,
      );

      setLocales(saved.cleaned);
      setDefaultLocale(saved.defaultLocale);
      setAdminDefaultLocale(saved.adminDefaultLocale);
      setFrontendDefaultLocale(saved.frontendDefaultLocale);

      registerSettings({
        localization_locales: JSON.stringify(saved.cleaned.map(({ id, ...rest }) => rest)),
        enabled_locales: saved.enabledCodes.join(','),
        default_locale: saved.defaultLocale,
        admin_default_locale: saved.adminDefaultLocale,
        frontend_default_locale: saved.frontendDefaultLocale,
        locale_url_strategy: localeUrlStrategy
      });

      addNotification({
        title: 'Localization Updated',
        message: 'Locale registry and defaults have been saved.',
        type: 'success'
      });
    } catch (error: any) {
      addNotification({
        title: 'Save Failed',
        message: error?.message || 'Failed to save localization settings.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12">
        <Loader label="Loading Localization Matrix..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Localization
          </h1>
          <p className="text-[10px] font-semibold text-slate-500 tracking-wide opacity-60">
            Locale Registry & Language Defaults
          </p>
        </div>
        <Button
          icon={<FrameworkIcons.Save size={14} strokeWidth={3} />}
          onClick={handleSave}
          isLoading={isSaving}
          className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
        >
          Save Localization
        </Button>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8">
        <LocaleRegistryCard
          locales={locales}
          theme={theme}
          updateLocale={updateLocale}
          addLocale={addLocale}
          removeLocale={removeLocale}
        />

        <LocaleTargetsCard
          theme={theme}
          localeSelectOptions={localeSelectOptions}
          defaultLocale={defaultLocale}
          setDefaultLocale={setDefaultLocale}
          adminDefaultLocale={adminDefaultLocale}
          setAdminDefaultLocale={setAdminDefaultLocale}
          frontendDefaultLocale={frontendDefaultLocale}
          setFrontendDefaultLocale={setFrontendDefaultLocale}
          localeUrlStrategy={localeUrlStrategy}
          setLocaleUrlStrategy={setLocaleUrlStrategy}
        />
      </div>
    </div>
  );
}
