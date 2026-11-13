import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ChangeEvent, ReactNode } from 'react';

import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The platform number field, used by every number field the FieldRenderer draws.
 *
 * Every number field has − and + at either end of the box, each a full control's height so a finger can
 * hit them on a phone; they step by the declared `step` (0.5, 0.01, 1 …), or by one when none is
 * declared, and stop at min/max.
 *
 * Any number can be typed by hand, whatever the step: "0,05" or "0.05", "-3", "12,5". While the field
 * has focus it shows exactly what was typed and hands the caller the number it means, so "0,0" on the
 * way to "0,05" is not turned into "0" under the cursor (callers that store the value as a string
 * re-render it, and the browser's own number box rewrote it). Typed values are clamped to min/max when
 * the field is left.
 */
export class NumberStepper extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<NumberStepper, 'value' | 'onChange' | 'disabled' | 'error' | 'placeholder' | 'step' | 'min' | 'max' | 'size'>;

  @prop declare value: number | string | null | undefined;
  @prop declare onChange: (value: number | string) => void;
  @prop declare disabled?: boolean;
  @prop declare error?: string;
  @prop declare placeholder?: string;
  /** Increment applied by the − and + controls and the arrow keys. Defaults to 1. */
  @prop declare step?: number;
  @prop declare min?: number;
  @prop declare max?: number;
  /** Accepted for callers that still pass it; every field is one size (UiFieldUtils). */
  @prop declare size?: FieldSize;

  /** What is in the box while it has focus; null when the box shows the value itself. */
  @state private draft: string | null = null;

  /** "0,05" and "0.05" are the same number; a lone "-", "," or "" is not a number yet. */
  static parse(raw: string): number | null {
    const text = raw.trim().replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * A number as the console's language writes it — "12,5" in Bulgarian, "12.5" in English — with no
   * rounding and no grouping, so what is shown can be typed back exactly.
   */
  static format(value: number, locale: string = AdminI18n.locale): string {
    const mark = (1.5).toLocaleString(locale || undefined).charAt(1);
    return String(value).replace('.', mark === ',' ? ',' : '.');
  }

  private stepSize(): number {
    const step = Number(this.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  private clamp(value: number): number {
    let next = value;
    const min = Number(this.min);
    const max = Number(this.max);
    if (this.min !== undefined && this.min !== null && Number.isFinite(min)) next = Math.max(min, next);
    if (this.max !== undefined && this.max !== null && Number.isFinite(max)) next = Math.min(max, next);
    // Round to kill floating-point drift when stepping by decimals (0.1 + 0.2 …).
    return Math.round(next * 1e6) / 1e6;
  }

  private current(): number | null {
    if (typeof this.value === 'number') return Number.isFinite(this.value) ? this.value : null;
    if (typeof this.value === 'string') return NumberStepper.parse(this.value);
    return null;
  }

  private bump(direction: 1 | -1): void {
    if (this.disabled) return;
    const current = this.current();
    const min = Number(this.min);
    const base = current ?? (this.min !== undefined && Number.isFinite(min) ? min : 0);
    const next = this.clamp(base + direction * this.stepSize());
    if (this.draft !== null) this.draft = NumberStepper.format(next);
    this.onChange(next);
  }

  @bound private increment(): void {
    this.bump(1);
  }

  @bound private decrement(): void {
    this.bump(-1);
  }

  @bound private onType(e: ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value;
    this.draft = raw;
    if (raw.trim() === '') { this.onChange(''); return; }
    const parsed = NumberStepper.parse(raw);
    if (parsed !== null) this.onChange(parsed);
  }

  @bound private onKey(e: { key: string; preventDefault: () => void }): void {
    if (e.key === 'ArrowUp') { e.preventDefault(); this.bump(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.bump(-1); }
  }

  @bound private onEnter(): void {
    this.draft = this.shown();
  }

  /**
   * A typed number is clamped when the field is left, not on every keystroke — typing "200" into a
   * field whose minimum is 64 must not snap to 64 at the "2".
   */
  @bound private onLeave(): void {
    this.draft = null;
    const current = this.current();
    if (current === null) return;
    const clamped = this.clamp(current);
    if (clamped !== current) this.onChange(clamped);
  }

  private shown(): string {
    const current = this.current();
    if (current !== null) return NumberStepper.format(current);
    return typeof this.value === 'string' ? this.value : '';
  }

  /** A declared bound, said to assistive technology the way a number box would say min/max. */
  private bound(value: number | undefined): number | undefined {
    const bound = Number(value);
    return value !== undefined && value !== null && Number.isFinite(bound) ? bound : undefined;
  }

  /** The phone keypad: whole numbers only where a whole step is declared and nothing below zero. */
  private get wholeNumbersOnly(): boolean {
    const step = Number(this.step);
    return Number.isInteger(step) && step >= 1 && Number(this.min) >= 0;
  }

  render(): ReactNode {
    const { disabled, error, placeholder } = this;
    // One size for every field (UiFieldUtils), so the buttons are always the 40px box's.
    // Each button is a square the input's own height (minus its border), inside the box at either end.
    const btn = `absolute top-px flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors h-[calc(2.5rem_-_2px)] w-10`;
    return (
      <div className="relative min-w-[7.5rem]">
        <Input
          type="text"
          role="spinbutton"
          aria-valuemin={this.bound(this.min)}
          aria-valuemax={this.bound(this.max)}
          aria-valuenow={this.current() ?? undefined}
          inputMode={this.wholeNumbersOnly ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={this.draft ?? this.shown()}
          onChange={this.onType}
          onFocus={this.onEnter}
          onBlur={this.onLeave}
          onKeyDown={this.onKey}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          inputClassName="px-10 text-center tabular-nums"
        />
        <button type="button" disabled={disabled} aria-label={AdminI18n.t('ui.stepper.decrement')} onClick={this.decrement}
          className={`${btn} start-px rounded-l-[calc(var(--radius)_-_1px)]`}>
          <FrameworkIcons.Minus size={15} strokeWidth={2.25} />
        </button>
        <button type="button" disabled={disabled} aria-label={AdminI18n.t('ui.stepper.increment')} onClick={this.increment}
          className={`${btn} end-px rounded-r-[calc(var(--radius)_-_1px)]`}>
          <FrameworkIcons.Plus size={15} strokeWidth={2.25} />
        </button>
      </div>
    );
  }
}
