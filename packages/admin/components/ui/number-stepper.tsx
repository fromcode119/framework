import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ChangeEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The platform number field, used by every number field the FieldRenderer draws.
 *
 * A whole-number field (a declared whole `step`: stock, quantities) gets − and + buttons at either end of
 * the box, each a full control's height, so a finger can hit them on a phone. Any other number — a price,
 * a weight, a field with no step — is a plain box with the number keypad: stepping 6.90 by one is never
 * what anyone wants, and the old pair of 10px arrows stacked in the corner was too small to tap.
 * Typed values are clamped to min/max when the field is left.
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

  /**
   * What the browser accepts when a value is typed: the declared step, or ANY number when none is
   * declared. Handing it the +/- size (1) made it refuse every decimal — "10,99" in a price was invalid,
   * nearest 10 or 11 — on each number field that never named a step.
   */
  private get typedStep(): number | 'any' {
    const step = Number(this.step);
    return Number.isFinite(step) && step > 0 ? step : 'any';
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

  /**
   * A typed number is clamped when the field is left, not on every keystroke — typing "200" into a
   * field whose minimum is 64 must not snap to 64 at the "2". Without this only the +/- controls
   * clamped, and a typed value past `max` was saved as typed.
   */
  @bound private onLeave(): void {
    const current = typeof this.value === 'number' ? this.value : Number(this.value);
    if (this.value === '' || this.value === null || this.value === undefined || !Number.isFinite(current)) return;
    const clamped = this.clamp(current);
    if (clamped !== current) this.onChange(clamped);
  }

  /** − and + only where stepping by one is meaningful: a declared whole-number step. */
  private get stepsByWholeNumbers(): boolean {
    const step = Number(this.step);
    return Number.isInteger(step) && step >= 1;
  }

  private renderInput(withButtons: boolean): ReactNode {
    const { value, disabled, error, placeholder, min, max } = this;
    const sm = this.size === FieldSize.SM;
    const pad = withButtons ? (sm ? 'px-8 text-center' : 'px-10 text-center') : '';
    return (
      <Input
        type="number"
        inputMode={withButtons ? 'numeric' : 'decimal'}
        size={sm ? FieldSize.SM : FieldSize.MD}
        value={(typeof value === 'number' || typeof value === 'string') ? value : ''}
        onChange={this.onType}
        onBlur={this.onLeave}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        min={min as any}
        max={max as any}
        step={this.typedStep as any}
        inputClassName={`${pad} tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
    );
  }

  render(): ReactNode {
    if (!this.stepsByWholeNumbers) return this.renderInput(false);
    const sm = this.size === FieldSize.SM;
    // Each button is a square the input's own height (minus its border), inside the box at either end.
    const btn = `absolute top-px flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors ${sm ? 'h-[calc(2.25rem_-_2px)] w-8' : 'h-[calc(2.5rem_-_2px)] w-10'}`;
    return (
      <div className="relative">
        {this.renderInput(true)}
        <button type="button" disabled={this.disabled} aria-label={AdminI18n.t('ui.stepper.decrement')} onClick={this.decrement}
          className={`${btn} left-px rounded-l-[calc(var(--radius)_-_1px)]`}>
          <FrameworkIcons.Minus size={sm ? 13 : 15} strokeWidth={2.25} />
        </button>
        <button type="button" disabled={this.disabled} aria-label={AdminI18n.t('ui.stepper.increment')} onClick={this.increment}
          className={`${btn} right-px rounded-r-[calc(var(--radius)_-_1px)]`}>
          <FrameworkIcons.Plus size={sm ? 13 : 15} strokeWidth={2.25} />
        </button>
      </div>
    );
  }
}
