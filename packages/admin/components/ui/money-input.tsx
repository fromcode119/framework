"use client";

import React from 'react';
import { Input } from './input';
import { CurrencySelect } from './currency-select';
import { UiFieldUtils } from '@/lib/ui';
import type { MoneyInputProps } from './money-input.interfaces';

/** Round to 2 decimals without depending on SDK utils (admin-local). */
function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * Amount + currency editor. Value shape `{ amount, currency }`. Pairs the admin {@link Input}
 * (numeric) with {@link CurrencySelect} so money fields stop being bare strings/numbers.
 */
export class MoneyInput extends React.Component<MoneyInputProps> {
  render(): React.ReactNode {
    const { value, onChange, currencies, theme = 'light', disabled, size = 'md', label, defaultCurrency = 'EUR' } = this.props;
    const amount = value?.amount ?? 0;
    const currency = value?.currency || defaultCurrency;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label ? <label className={UiFieldUtils.TEXT.LABEL}>{label}</label> : null}
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              size={size}
              disabled={disabled}
              onChange={(e) => onChange({ amount: round2(parseFloat(e.target.value) || 0), currency })}
              placeholder="0.00"
            />
          </div>
          <div className="w-44 flex-shrink-0">
            <CurrencySelect
              value={currency}
              onChange={(code) => onChange({ amount, currency: code })}
              currencies={currencies}
              theme={theme}
              disabled={disabled}
              size={size}
            />
          </div>
        </div>
      </div>
    );
  }
}
