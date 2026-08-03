import type { IPermalinkValue } from '@/components/ui/interfaces/permalink-value.interface';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Input } from '@/components/ui/view/input.client';

export class PermalinkField extends PureReactor {
  @prop declare value: IPermalinkValue | null | undefined;
  @prop declare onChange: (value: IPermalinkValue) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;

  private get resolvedTheme(): ThemeMode {
    return this.theme ?? ThemeMode.LIGHT;
  }

  private get isFieldDisabled(): boolean {
    return this.disabled ?? false;
  }

  private get custom(): string {
    return typeof this.value?.custom === 'string' ? this.value.custom : '';
  }

  private get isDisabled(): boolean {
    return Boolean(this.value?.disabled);
  }

  private update(patch: Partial<IPermalinkValue>): void {
    this.onChange({ custom: this.custom, disabled: this.isDisabled, ...patch });
  }

  @bound onCustomChange(e: ChangeEvent<HTMLInputElement>): void {
    this.update({ custom: e.target.value });
  }

  @bound onToggle(): void {
    if (!this.isFieldDisabled) this.update({ disabled: !this.isDisabled });
  }

  render(): ReactNode {
    const theme = this.resolvedTheme;
    const disabled = this.isFieldDisabled;
    const custom = this.custom;
    const isDisabled = this.isDisabled;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        value={custom}
        onChange={this.onCustomChange}
        placeholder="/custom-url"
        disabled={disabled}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={isDisabled}
        onClick={this.onToggle}
        disabled={disabled}
        className={`flex items-center gap-2.5 w-full text-left select-none text-[12px] font-semibold transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-600'}`}
      >
        <div
          className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${
            isDisabled
              ? 'bg-rose-500'
              : theme === ThemeMode.DARK
                ? 'bg-slate-700'
                : 'bg-slate-200'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
              isDisabled ? 'left-[calc(100%-14px-2px)]' : 'left-0.5'
            }`}
          />
        </div>
        Disable public URL
      </button>
    </div>
  );
  }
}
