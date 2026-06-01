"use client";

import React from 'react';
import { Select } from './select';
import type { CurrencyOption, CurrencySelectProps } from './currency-select.interfaces';

/** Minimal fallback so the selector is usable even without the finance plugin present. */
const FALLBACK_CURRENCIES: CurrencyOption[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
];

/**
 * Currency picker built on the admin {@link Select}. Decoupled from finance: callers pass the
 * finance currency list via `currencies`; otherwise a common fallback set is used.
 */
export class CurrencySelect extends React.Component<CurrencySelectProps> {
  render(): React.ReactNode {
    const { value, onChange, currencies, theme = 'light', disabled, size = 'md', label, clearable } = this.props;
    const list = currencies && currencies.length ? currencies : FALLBACK_CURRENCIES;
    const options = list.map((c) => ({
      value: c.code,
      label: `${c.code} — ${c.name}${c.symbol ? ` (${c.symbol})` : ''}`,
    }));

    return (
      <Select
        value={value}
        onChange={onChange}
        options={options}
        theme={theme}
        disabled={disabled}
        size={size}
        label={label}
        placeholder="Select currency..."
        searchable
        clearable={clearable}
      />
    );
  }
}
