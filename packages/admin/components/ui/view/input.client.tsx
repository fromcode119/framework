import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { PureReactor, prop, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { UiFieldUtils } from '@/lib/ui';
import { FieldErrorMark } from '@/components/ui/view/field-error-mark.client';

export class Input extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<Input, 'label' | 'error' | 'className' | 'inputClassName' | 'size' | 'value'> & Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value'>

  @ref private declare elementRef: Ref<HTMLInputElement>;

  /** Focus the underlying field. A class-component ref hands back this instance, not the DOM node. */
  focus(): void {
    this.elementRef.current?.focus();
  }

  @prop declare label?: string;
  @prop declare error?: string;
  @prop declare className?: string;
  @prop declare inputClassName?: string;
  @prop declare size?: FieldSize;
  @prop declare value?: InputHTMLAttributes<HTMLInputElement>['value'];

  private get rest(): Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value'> {
    const { label, error, className, inputClassName, size, value, ...props } = this.props as Record<string, unknown>;
    return props as Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value'>;
  }

  /** Normalize the value to a string/number, handling objects if they slip through. */
  private get normalizedValue(): InputHTMLAttributes<HTMLInputElement>['value'] {
    const value = this.value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (value as any).label || (value as any).name || (value as any).title || (value as any).slug || (value as any).value || (value as any).id || '';
    }
    return value;
  }

  render(): ReactNode {
    const className = this.className ?? '';
    const inputClassName = this.inputClassName ?? '';
    const size = this.size ?? FieldSize.MD;
    const error = this.error;

    return (
      <div className={`fc-field-stack w-full ${className}`}>
        {this.label && <label className={UiFieldUtils.TEXT.LABEL}>{this.label}</label>}
        <div className="fc-field-wrap">
          <input
            ref={this.elementRef}
            {...this.rest}
            value={this.normalizedValue}
            aria-invalid={error ? true : undefined}
            className={`${UiFieldUtils.getFieldClasses(size, inputClassName)} ${error ? 'fc-field--error' : ''}`}
          />
          {error ? <FieldErrorMark message={error} /> : null}
        </div>
      </div>
    );
  }
}
