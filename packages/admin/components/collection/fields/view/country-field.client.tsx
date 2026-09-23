import { PlatformCountryUtils, ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { CountryCatalog } from '@/components/collection/fields/country-catalog';
import { PlatformCountryDescription } from '@/lib/settings/platform-country-description';
import { AdminPathUtils } from '@/lib/admin-path';

/**
 * Built-in, framework-owned country picker. Renders the complete ISO 3166-1 catalog as a searchable
 * dropdown, so any plugin field that means "pick a country" sets `admin.component: 'CountryField'`
 * instead of a free-text input. The list is static (countries don't change), exhaustive, and shared
 * — no per-plugin country constants and no "Other" escape hatch. Registered into the field-component
 * registry at admin bootstrap, so it also works inside array sub-fields.
 *
 * A field declaring `admin.inheritsPlatformCountry` is a module OVERRIDE of the platform country
 * (Settings → Localization): its blank option reads "Platform country — <country>", and while blank the
 * control says which country is in effect and why, so choosing nothing never hides the value in use.
 */
export class CountryField extends PureReactor {
  @prop declare value?: string;
  @prop declare onChange?: (value: string) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;
  @prop declare globalSettings?: Record<string, unknown>;

  render(): ReactNode {
    const { value, onChange, theme, disabled, field } = this;
    const readOnly = Boolean(field?.admin?.readOnly) || disabled;
    const inherits = Boolean(field?.admin?.inheritsPlatformCountry);
    const platform = PlatformCountryUtils.resolve(this.globalSettings);
    const options = inherits
      ? [{ value: '', label: `Platform country — ${CountryCatalog.labelFor(platform.country) || 'none'}` }, ...CountryCatalog.OPTIONS]
      : CountryCatalog.OPTIONS;

    return (
      <div>
        <Select
          value={value || ''}
          onChange={(next: string) => onChange?.(next)}
          options={options}
          placeholder="Select country…"
          searchable
          disabled={readOnly}
          theme={theme}
        />
        {inherits && !value && (
          <p className="mt-1.5 text-xs text-slate-500">
            In effect: {PlatformCountryDescription.describe(platform)}.{' '}
            <a className="underline" href={AdminPathUtils.toAdminPath('/settings/localization')}>Settings → Localization</a>
          </p>
        )}
      </div>
    );
  }
}
