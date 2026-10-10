import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';

/**
 * A labelled on/off control. The label and description are part of the control: clicking them
 * toggles it, as a checkbox's label does, and they name it for assistive technology. `className`
 * applies to the whole control (callers size it: `scale-75 origin-right shrink-0`).
 */
export class Switch extends PureReactor {
  declare props: Pick<Switch, 'checked' | 'onChange' | 'label' | 'description' | 'disabled' | 'className'>;

  @prop declare checked: boolean;
  @prop declare onChange: (checked: boolean) => void | Promise<void>;
  @prop declare label?: string;
  @prop declare description?: string;
  @prop declare disabled?: boolean;
  @prop declare className?: string;

  @bound handleToggle(): void {
    void this.onChange(!this.checked);
  }

  render(): ReactNode {
    const { checked, label, description, disabled, className } = this;
  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ''}`}>
      {(label || description) && (
        <div
          className={`flex flex-col select-none ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          onClick={disabled ? undefined : this.handleToggle}
        >
          {label && <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">{label}</span>}
          {description && <span className="text-xs text-slate-500">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || description}
        disabled={disabled}
        onClick={this.handleToggle}
        // The switch is 44×24 — the size phones use — and a pseudo-element widens what a finger can
        // hit to 44px tall without changing the layout. The off track is slate-300 so it reads as a
        // control on a white card; the ring shows for the keyboard only, not on every click.
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-out
          before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-['']
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out
            ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
  }
}
