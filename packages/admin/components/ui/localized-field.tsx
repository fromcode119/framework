"use client";

import React from 'react';
import { ContextHooks } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import type { LocalizedFieldProps } from './localized-field.interfaces';

export function LocalizedField({ label, input, localeScope = 'admin' }: LocalizedFieldProps) {
  const settings = ContextHooks.useGlobalSettings();
  const localization = AdminServices.getInstance().localization;
  const localeRegistry = React.useMemo(() => localization.parseLocaleRegistry(settings), [localization, settings]);
  const defaultLocale = React.useMemo(
    () => (
      localeScope === 'frontend'
        ? localization.resolveFrontendLocale(settings, localeRegistry)
        : localization.resolveAdminLocale(settings, localeRegistry)
    ),
    [localeRegistry, localeScope, localization, settings]
  );
  const [activeLocale, setActiveLocale] = React.useState(defaultLocale);

  React.useEffect(() => {
    if (!localeRegistry.length) {
      setActiveLocale(defaultLocale);
      return;
    }

    if (!localeRegistry.some((item) => item.code === activeLocale)) {
      setActiveLocale(defaultLocale);
    }
  }, [activeLocale, defaultLocale, localeRegistry]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        {localeRegistry.length ? (
          <select
            value={activeLocale}
            onChange={(event) => setActiveLocale(event.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            {localeRegistry.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.label} ({locale.code.toUpperCase()})
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {input(activeLocale)}
    </div>
  );
}
