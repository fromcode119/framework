"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@/lib/icons';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { NotificationHooks } from '@/components/use-notification';
import { Loader } from '@/components/ui/loader';
import { LocalizationPageUtils } from './localization-page-utils';
import { SettingsRegistrationService } from '@/lib/settings/settings-registration-service';

type LocaleItem = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
};

type LocaleUrlStrategy = 'query' | 'path' | 'none';

const FALLBACK_LOCALES: LocaleItem[] = [
  { id: 'en', code: 'en', name: 'English', enabled: true }
];

const SettingRow = ({ icon: Icon, title, description, children, theme }: any) => (
  <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
    <div className="flex gap-4">
      <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
        {Icon ? <Icon size={20} /> : <div className="w-5 h-5" />}
      </div>
      <div>
        <h3 className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      </div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);



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
        const response = await AdminApi.get(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS_BASE);
        const docs = response.docs || [];
        const map = new Map<string, string>();
        docs.forEach((doc: any) => map.set(String(doc.key), String(doc.value ?? '')));

        let parsedLocales = LocalizationPageUtils.parseLocales(map.get('localization_locales'));
        if (!parsedLocales.length) {
          const enabledCodes = String(map.get('enabled_locales') || 'en')
            .split(',')
            .map((value) => LocalizationPageUtils.normalizeLocaleCode(value))
            .filter(Boolean);
          parsedLocales = (enabledCodes.length ? enabledCodes : ['en']).map((code, index) => ({
            id: `${code}-${index}`,
            code,
            name: LocalizationPageUtils.languageNameFromCode(code),
            enabled: true
          }));
        }

        const enabledCodes = parsedLocales.filter((locale) => locale.enabled).map((locale) => locale.code);
        const firstEnabled = enabledCodes[0] || parsedLocales[0]?.code || 'en';

        setLocales(parsedLocales);
        setDefaultLocale(LocalizationPageUtils.normalizeLocaleCode(map.get('default_locale') || firstEnabled));
        setAdminDefaultLocale(LocalizationPageUtils.normalizeLocaleCode(map.get('admin_default_locale') || firstEnabled));
        setFrontendDefaultLocale(LocalizationPageUtils.normalizeLocaleCode(map.get('frontend_default_locale') || firstEnabled));
        const savedStrategy = String(map.get('locale_url_strategy') || 'query').trim().toLowerCase();
        setLocaleUrlStrategy(savedStrategy === 'path' || savedStrategy === 'none' ? savedStrategy : 'query');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const enabledLocaleOptions = useMemo(() => {
    const list = locales
      .map((locale) => ({
        ...locale,
        code: LocalizationPageUtils.normalizeLocaleCode(locale.code),
        name: String(locale.name || '').trim()
      }))
      .filter((locale) => locale.code && locale.enabled);

    return list.length ? list : [{ id: 'en', code: 'en', name: 'English', enabled: true }];
  }, [locales]);

  const localeSelectOptions = useMemo(
    () =>
      enabledLocaleOptions.map((locale) => ({
        value: locale.code,
        label: `${locale.name} (${locale.code})`
      })),
    [enabledLocaleOptions]
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
      const dedupe = new Set<string>();
      const cleaned = locales
        .map((locale) => {
          const code = LocalizationPageUtils.normalizeLocaleCode(locale.code);
          const name = String(locale.name || '').trim() || LocalizationPageUtils.languageNameFromCode(code);
          return { ...locale, code, name };
        })
        .filter((locale) => locale.code)
        .filter((locale) => {
          if (dedupe.has(locale.code)) return false;
          dedupe.add(locale.code);
          return true;
        });

      if (!cleaned.length) {
        addNotification({
          title: 'Invalid Locale List',
          message: 'Add at least one locale with a valid ISO code.',
          type: 'error'
        });
        return;
      }

      if (!cleaned.some((locale) => locale.enabled)) {
        cleaned[0].enabled = true;
      }

      const enabledCodes = cleaned.filter((locale) => locale.enabled).map((locale) => locale.code);
      const firstEnabled = enabledCodes[0];
      const pickDefault = (value: string) => {
        const normalized = LocalizationPageUtils.normalizeLocaleCode(value);
        return enabledCodes.includes(normalized) ? normalized : firstEnabled;
      };

      const nextDefaultLocale = pickDefault(defaultLocale);
      const nextAdminDefault = pickDefault(adminDefaultLocale);
      const nextFrontendDefault = pickDefault(frontendDefaultLocale);

      await Promise.all([
        AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('localization_locales'), {
          value: JSON.stringify(cleaned.map(({ id, ...rest }) => rest))
        }),
        AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('enabled_locales'), {
          value: enabledCodes.join(',')
        }),
        AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('default_locale'), {
          value: nextDefaultLocale
        }),
        AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('admin_default_locale'), {
          value: nextAdminDefault
        }),
        AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('frontend_default_locale'), {
          value: nextFrontendDefault
        }),
        AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.SETTINGS('locale_url_strategy'), {
          value: localeUrlStrategy
        })
      ]);

      setLocales(cleaned);
      setDefaultLocale(nextDefaultLocale);
      setAdminDefaultLocale(nextAdminDefault);
      setFrontendDefaultLocale(nextFrontendDefault);

      registerSettings({
        localization_locales: JSON.stringify(cleaned.map(({ id, ...rest }) => rest)),
        enabled_locales: enabledCodes.join(','),
        default_locale: nextDefaultLocale,
        admin_default_locale: nextAdminDefault,
        frontend_default_locale: nextFrontendDefault,
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
        <Card title="Locale Registry">
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              Define language name + ISO code, then enable or disable each locale.
            </p>

            <div className="space-y-3">
              {locales.map((locale) => (
                <div
                  key={locale.id}
                  className={`rounded-xl border p-4 ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-4">
                      <Input
                        value={locale.name}
                        onChange={(e) => updateLocale(locale.id, { name: e.target.value })}
                        placeholder="Language name (e.g. English)"
                        className="font-semibold"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input
                        value={locale.code}
                        onChange={(e) => updateLocale(locale.id, { code: e.target.value })}
                        placeholder="ISO code (e.g. en, en-gb)"
                        className="font-mono font-semibold"
                      />
                    </div>
                    <div className="md:col-span-3 flex items-center gap-3">
                      <Switch
                        checked={locale.enabled}
                        onChange={(value) => updateLocale(locale.id, { enabled: value })}
                      />
                      <span className="text-sm font-medium text-slate-500 tracking-wide">Enabled</span>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeLocale(locale.id)}
                        disabled={locales.length <= 1}
                        className={`px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide transition-all ${
                          locales.length <= 1
                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                            : theme === 'dark'
                              ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                              : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3">
              <Button
                icon={<FrameworkIcons.Plus size={14} strokeWidth={3} />}
                onClick={addLocale}
                className="rounded-xl"
              >
                Add Locale
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Default Locale Targets">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title="System Default Locale"
            description="Primary locale used by system-level fallback logic."
          >
            <Select
              value={defaultLocale}
              onChange={setDefaultLocale}
              options={localeSelectOptions}
              placeholder="Select system locale"
              searchable={false}
              theme={theme}
              className="w-full md:w-64"
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Settings}
            title="Admin Default Locale"
            description="Default language used by the framework admin interface."
          >
            <Select
              value={adminDefaultLocale}
              onChange={setAdminDefaultLocale}
              options={localeSelectOptions}
              placeholder="Select admin locale"
              searchable={false}
              theme={theme}
              className="w-full md:w-64"
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Layout}
            title="Frontend Default Locale"
            description="Default language used by frontend rendering/runtime fallback."
          >
            <Select
              value={frontendDefaultLocale}
              onChange={setFrontendDefaultLocale}
              options={localeSelectOptions}
              placeholder="Select frontend locale"
              searchable={false}
              theme={theme}
              className="w-full md:w-64"
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title="Locale URL Strategy"
            description='Choose locale routing style: `?locale=bg`, `/bg/...`, or locale hidden in URL.'
          >
            <Select
              value={localeUrlStrategy}
              onChange={(value) => setLocaleUrlStrategy((value as LocaleUrlStrategy) || 'query')}
              options={[
                { value: 'query', label: 'Query Parameter (?locale=bg)' },
                { value: 'path', label: 'Path Prefix (/bg/...)' },
                { value: 'none', label: 'No Locale in URL' }
              ]}
              placeholder="Select locale URL strategy"
              searchable={false}
              theme={theme}
              className="w-full md:w-64"
            />
          </SettingRow>
        </Card>
      </div>
    </div>
  );
}
