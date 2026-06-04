"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { AdminServices } from '@/lib/admin-services';
import type { LocalizedFieldProps } from './localized-field.interfaces';

interface LocalizedFieldState {
  activeLocale: string;
}

interface ResolvedLocaleContext {
  localeRegistry: Array<{ code: string; label: string }>;
  defaultLocale: string;
}

export class LocalizedField extends AdminComponent<LocalizedFieldProps, LocalizedFieldState> {
  state: LocalizedFieldState = { activeLocale: this.resolve().defaultLocale };

  private resolve(): ResolvedLocaleContext {
    const settings = this.runtime?.globalSettings ?? {};
    const localization = AdminServices.getInstance().localization;
    const localeRegistry = localization.parseLocaleRegistry(settings);
    const defaultLocale = this.props.localeScope === 'frontend'
      ? localization.resolveFrontendLocale(settings, localeRegistry)
      : localization.resolveAdminLocale(settings, localeRegistry);
    return { localeRegistry, defaultLocale };
  }

  private reconcileLocale(): void {
    const { localeRegistry, defaultLocale } = this.resolve();
    if (!localeRegistry.length) {
      if (this.state.activeLocale !== defaultLocale) this.setState({ activeLocale: defaultLocale });
      return;
    }

    if (!localeRegistry.some((item) => item.code === this.state.activeLocale)) {
      this.setState({ activeLocale: defaultLocale });
    }
  }

  componentDidMount(): void {
    // Context is only populated after construction, so reconcile once mounted.
    this.reconcileLocale();
  }

  componentDidUpdate(): void {
    this.reconcileLocale();
  }

  render(): React.ReactNode {
    const { label, input } = this.props;
    const { localeRegistry } = this.resolve();
    const { activeLocale } = this.state;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
          {localeRegistry.length ? (
            <select
              value={activeLocale}
              onChange={(event) => this.setState({ activeLocale: event.target.value })}
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
}
