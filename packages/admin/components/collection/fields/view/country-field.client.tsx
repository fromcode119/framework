import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Select } from '@/components/ui/view/select.client';
import { CountryCatalog } from '@/components/collection/fields/country-catalog';

/**
 * Built-in, framework-owned country picker. Renders the complete ISO 3166-1 catalog as a searchable
 * dropdown, so any plugin field that means "pick a country" sets `admin.component: 'CountryField'`
 * instead of a free-text input. The list is static (countries don't change), exhaustive, and shared
 * — no per-plugin country constants and no "Other" escape hatch. Registered into the field-component
 * registry at admin bootstrap, so it also works inside array sub-fields.
 */
export class CountryField extends PureReactor {
  @prop declare value?: string;
  @prop declare onChange?: (value: string) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  render(): ReactNode {
    const { value, onChange, theme, disabled, field } = this;
    const readOnly = Boolean(field?.admin?.readOnly) || disabled;

    return (
      <Select
        value={value || ''}
        onChange={(next: string) => onChange?.(next)}
        options={CountryCatalog.OPTIONS}
        placeholder="Select country…"
        searchable
        disabled={readOnly}
        theme={theme}
      />
    );
  }
}
