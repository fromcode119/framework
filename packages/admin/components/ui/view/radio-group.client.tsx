import type { KeyboardEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * One of a FEW choices, all of them in view: two to five options a person should compare before
 * choosing. More than that, or options that need no comparing, is a `Select`.
 *
 * `boxed` draws each option as its own bordered box with its explanation, for a choice that changes
 * how something works ("Fixed amount" / "Percentage") rather than a plain value. The arrows move the
 * choice, as in any radio group; a disabled option is skipped.
 */
export class RadioGroup extends PureReactor {
  @prop declare options: Array<{ value: string; label: ReactNode; description?: ReactNode; disabled?: boolean }>;
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare boxed?: boolean;
  /** Boxed options side by side, two to a line, where the card is wide enough for two. */
  @prop declare twoColumns?: boolean;
  @prop declare disabled?: boolean;
  /** What is being chosen, for a screen reader. */
  @prop declare label?: string;
  @prop declare className?: string;

  private static readonly NEXT = ['ArrowDown', 'ArrowRight'];
  private static readonly PREVIOUS = ['ArrowUp', 'ArrowLeft'];

  @bound private onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const forward = RadioGroup.NEXT.includes(event.key);
    if (!forward && !RadioGroup.PREVIOUS.includes(event.key)) return;
    const usable = this.options.filter((option) => !option.disabled);
    if (this.disabled || usable.length < 2) return;
    event.preventDefault();
    const at = Math.max(0, usable.findIndex((option) => option.value === this.value));
    const index = (at + (forward ? 1 : -1) + usable.length) % usable.length;
    this.onChange(usable[index].value);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')[index]?.focus();
  }

  render(): ReactNode {
    const name = AdminClass.of('radio');
    const chosen = this.options.some((option) => option.value === this.value && !option.disabled);
    return (
      <div role="radiogroup" aria-label={this.label} className={`${name}-group ${this.className ?? ''}`} data-boxed={this.boxed ? 'true' : undefined} data-columns={this.twoColumns ? '2' : undefined} onKeyDown={this.onKeyDown}>
        {this.options.map((option, index) => {
          const on = option.value === this.value;
          const off = Boolean(this.disabled || option.disabled);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={off}
              // One stop for the keyboard: the chosen option, or the first when nothing is chosen.
              tabIndex={on || (!chosen && index === 0) ? 0 : -1}
              className={name}
              onClick={() => this.onChange(option.value)}
            >
              <span className={`${name}__hit`}><span className={`${name}__dot`} data-checked={on ? 'true' : 'false'} /></span>
              <span className={`${name}__text`}>
                <span className={`${name}__label`}>{option.label}</span>
                {option.description ? <span className={`${name}__description`}>{option.description}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
}
