"use client";

import React from 'react';
import { Select } from '@/components/ui/select';
import { CountryCatalog } from './country-catalog';
import type { CountryFieldProps } from './country-field.interfaces';

/**
 * Built-in, framework-owned country picker. Renders the complete ISO 3166-1 catalog as a searchable
 * dropdown, so any plugin field that means "pick a country" sets `admin.component: 'CountryField'`
 * instead of a free-text input. The list is static (countries don't change), exhaustive, and shared
 * — no per-plugin country constants and no "Other" escape hatch. Registered into the field-component
 * registry at admin bootstrap, so it also works inside array sub-fields.
 */
export class CountryField extends React.Component<CountryFieldProps> {
  render(): React.ReactNode {
    const { value, onChange, theme, disabled, field } = this.props;
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
