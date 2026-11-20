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
    <div className={`fc-switch-field ${className ?? ''}`}>
      {(label || description) && (
        <div
          className={`fc-switch-field__text${disabled ? ' fc-switch-field__text--off' : ''}`}
          onClick={disabled ? undefined : this.handleToggle}
        >
          {label && <span className="fc-field-label">{label}</span>}
          {description && <span className="fc-switch__hint">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || description}
        disabled={disabled}
        onClick={this.handleToggle}
        // 32×18, the figure the record pages this console follows keep; it was 44×24, the size a
        // phone's own switch is, which stood a head taller than the 32px field beside it. A
        // pseudo-element still widens what a finger can hit, without changing the layout.
        className={`fc-switch${checked ? ' fc-switch--on' : ''}`}
      >
        <span
          aria-hidden="true"
          className="fc-switch__knob"
        />
      </button>
    </div>
  );
  }
}
