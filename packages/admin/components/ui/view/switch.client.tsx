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
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-indigo-600 shadow-inner shadow-indigo-900/20' : 'bg-slate-200 dark:bg-slate-700 shadow-inner shadow-slate-900/10'}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md shadow-slate-900/20 ring-0 transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
  }
}
