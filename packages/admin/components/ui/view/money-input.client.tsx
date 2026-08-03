import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Input } from '@/components/ui/view/input.client';
import { CurrencySelect } from '@/components/ui/view/currency-select.client';
import { UiFieldUtils } from '@/lib/ui';
import { ICurrencyOption } from '@/components/ui/interfaces/currency-option.interface';
import { IMoneyValue } from '@/components/ui/interfaces/money-value.interface';

/**
 * Amount + currency editor. Value shape `{ amount, currency }`. Pairs the admin {@link Input}
 * (numeric) with {@link CurrencySelect} so money fields stop being bare strings/numbers.
 */
export class MoneyInput extends PureReactor {
  /** Round to 2 decimals without depending on SDK utils (admin-local). */
  private static round2(value: number): number {
    return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  }

  @prop declare value: IMoneyValue | null | undefined;
  @prop declare onChange: (value: IMoneyValue) => void;
  @prop declare currencies?: ICurrencyOption[];
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare size?: FieldSize;
  @prop declare label?: string;
  /** Default currency when value has none. Defaults to 'EUR'. */
  @prop declare defaultCurrency?: string;

  render(): ReactNode {
    const { value, onChange, currencies, disabled, label } = this;
    const theme = this.theme ?? ThemeMode.LIGHT;
    const size = this.size ?? FieldSize.MD;
    const amount = value?.amount ?? 0;
    const currency = value?.currency || this.defaultCurrency || 'EUR';

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
              onChange={(e) => onChange({ amount: MoneyInput.round2(parseFloat(e.target.value) || 0), currency })}
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
