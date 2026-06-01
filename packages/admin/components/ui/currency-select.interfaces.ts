export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
  symbolPosition?: string;
  isDefault?: boolean;
}

export interface CurrencySelectProps {
  value: string;
  onChange: (code: string) => void;
  /** Currencies to offer. When omitted, falls back to a minimal common set. Plugins should pass
   *  the finance plugin's list: `usePluginsNamespace('org.fromcode').finance.listCurrencies()`. */
  currencies?: CurrencyOption[];
  theme?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  clearable?: boolean;
}
