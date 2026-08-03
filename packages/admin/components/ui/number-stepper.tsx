import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ChangeEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * The platform number field: a numeric input with explicit +/- stepper controls (and clamping to
 * min/max), replacing the bare browser `<input type="number">`. Used by every number field the
 * FieldRenderer draws, so it is consistent across the whole admin (default shell + appearances).
 */
export class NumberStepper extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<NumberStepper, 'value' | 'onChange' | 'disabled' | 'error' | 'placeholder' | 'step' | 'min' | 'max' | 'size'>;

  @prop declare value: number | string | null | undefined;
  @prop declare onChange: (value: number | string) => void;
  @prop declare disabled?: boolean;
  @prop declare error?: string;
  @prop declare placeholder?: string;
  /** Increment applied by the +/- controls (and native arrows). Defaults to 1. */
  @prop declare step?: number;
  @prop declare min?: number;
  @prop declare max?: number;
  /** 'sm' = compact variant for dense grids (e.g. the per-tier rate matrix). Default 'md'. */
  @prop declare size?: FieldSize;

  private stepSize(): number {
    const step = Number(this.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  private clamp(value: number): number {
    let next = value;
    const min = Number(this.min);
    const max = Number(this.max);
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);
    // Round to kill floating-point drift when stepping by decimals (0.1 + 0.2 …).
    return Math.round(next * 1e6) / 1e6;
  }

  private bump(direction: 1 | -1): void {
    if (this.disabled) return;
    const current = Number(this.value);
    const base = Number.isFinite(current) ? current : (Number.isFinite(Number(this.min)) ? Number(this.min) : 0);
    this.onChange(this.clamp(base + direction * this.stepSize()));
  }

  @bound private increment(): void {
    this.bump(1);
  }

  @bound private decrement(): void {
    this.bump(-1);
  }

  @bound private onType(e: ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value;
    if (raw === '') { this.onChange(''); return; }
    const parsed = Number(raw);
    this.onChange(Number.isFinite(parsed) ? parsed : raw);
  }

  render(): ReactNode {
    const { value, disabled, error, placeholder, min, max } = this;
    const sm = this.size === FieldSize.SM;
    const btn = 'flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 active:bg-indigo-100 dark:active:bg-indigo-500/25 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer';
    return (
      <div className="relative">
        <Input
          type="number"
          size={sm ? FieldSize.SM : FieldSize.MD}
          value={(typeof value === 'number' || typeof value === 'string') ? value : ''}
          onChange={this.onType}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          min={min as any}
          max={max as any}
          step={this.stepSize()}
          inputClassName={`${sm ? 'pr-7 text-center' : 'pr-12'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        {/* A distinct stepper "well" on the right: fixed to the input height (an error below never shifts it),
            separated by a border, with a divider between the up/down halves so it reads as a real control. */}
        <div className={`absolute right-0 top-0 flex flex-col rounded-r-lg overflow-hidden border-l border-slate-200 dark:border-slate-700 ${sm ? 'h-8 w-6' : 'h-10 w-10'}`}>
          <button type="button" tabIndex={-1} disabled={disabled} aria-label="Increment" onClick={this.increment} className={btn}>
            <FrameworkIcons.ChevronUp size={sm ? 11 : 15} strokeWidth={2.5} />
          </button>
          <div className="h-px bg-slate-200 dark:bg-slate-700" />
          <button type="button" tabIndex={-1} disabled={disabled} aria-label="Decrement" onClick={this.decrement} className={btn}>
            <FrameworkIcons.ChevronDown size={sm ? 11 : 15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }
}
