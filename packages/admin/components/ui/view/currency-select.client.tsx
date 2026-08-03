import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Select } from '@/components/ui/view/select.client';
import { ICurrencyOption } from '@/components/ui/interfaces/currency-option.interface';

/** Minimal fallback so the selector is usable even without the finance plugin present. */

/**
 * Currency picker built on the admin {@link Select}. Decoupled from finance: callers pass the
 * finance currency list via `currencies`; otherwise a common fallback set is used.
 */
export class CurrencySelect extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<CurrencySelect, 'value' | 'onChange' | 'currencies' | 'theme' | 'disabled' | 'size' | 'label' | 'clearable'>;

  private static readonly FALLBACK_CURRENCIES: ICurrencyOption[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
];

  @prop declare value: string;
  @prop declare onChange: (code: string) => void;
  @prop declare currencies?: ICurrencyOption[];
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare size?: FieldSize;
  @prop declare label?: string;
  @prop declare clearable?: boolean;

  render(): ReactNode {
    const { value, onChange, currencies, disabled, label, clearable } = this;
    const theme = this.theme ?? ThemeMode.LIGHT;
    const size = this.size ?? FieldSize.MD;
    const list = currencies && currencies.length ? currencies : CurrencySelect.FALLBACK_CURRENCIES;
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
