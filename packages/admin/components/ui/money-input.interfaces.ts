import type { CurrencyOption } from './currency-select.interfaces';

export interface MoneyValue {
  amount: number;
  currency: string;
}

export interface MoneyInputProps {
  value: MoneyValue | null | undefined;
  onChange: (value: MoneyValue) => void;
  currencies?: CurrencyOption[];
  theme?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  /** Default currency when value has none. Defaults to 'EUR'. */
  defaultCurrency?: string;
}
