export interface ICurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
  symbolPosition?: string;
  isDefault?: boolean;
}
