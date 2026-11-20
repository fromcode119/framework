import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { FieldErrorMark } from '@/components/ui/view/field-error-mark.client';

/**
 * A field with a fixed part before and/or after what is typed: a unit, a code, a sign, a domain.
 * The parts are shown, never typed and never part of the value. What they say is the caller's — the
 * field knows nothing of what the value means.
 */
export class AffixInput extends PureReactor<Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'prefix'>> {
  /** The input's own attributes plus the declared @prop fields, so call sites are type-checked. */
  declare props: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'prefix'> & Pick<AffixInput, 'value' | 'onChange' | 'leading' | 'trailing' | 'label' | 'error' | 'alignEnd' | 'className'>;
  @prop declare value: string | number;
  @prop declare onChange: (value: string) => void;
  /** The fixed part before the value. */
  @prop declare leading?: ReactNode;
  /** The fixed part after the value. */
  @prop declare trailing?: ReactNode;
  @prop declare label?: string;
  @prop declare error?: string;
  /** The value stands against the end of the field, the way a figure is read. */
  @prop declare alignEnd?: boolean;
  @prop declare className?: string;

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    this.onChange(event.target.value);
  }

  render(): ReactNode {
    const name = AdminClass.of('affix');
    const { value, onChange: _onChange, leading, trailing, label, error, alignEnd, className, ...rest } = this.props as any;
    return (
      <div className={`fc-field-stack w-full ${className ?? ''}`}>
        {label ? <label className="fc-field-label">{label}</label> : null}
        <div className="fc-field-wrap">
          <span className={`${name}${error ? ` ${name}--error` : ''}${rest.disabled ? ` ${name}--disabled` : ''}`}>
            {leading ? <span className={`${name}__part ${name}__part--leading`}>{leading}</span> : null}
            <input {...rest} value={value ?? ''} onChange={this.change} aria-label={rest['aria-label'] ?? label} aria-invalid={error ? true : undefined} className={`${name}__input${alignEnd ? ` ${name}__input--end` : ''}`} />
            {trailing ? <span className={`${name}__part ${name}__part--trailing`}>{trailing}</span> : null}
          </span>
          {error ? <FieldErrorMark message={error} /> : null}
        </div>
      </div>
    );
  }
}
