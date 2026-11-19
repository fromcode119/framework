import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode, TextareaHTMLAttributes } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FieldErrorMark } from '@/components/ui/view/field-error-mark.client';
import { UiFieldUtils } from '@/lib/ui';

export class TextArea extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<TextArea, 'label' | 'error' | 'className' | 'inputClassName' | 'value' | 'size'>
    & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'className'>;

  @prop declare label?: string;
  @prop declare error?: string;
  @prop declare className?: string;
  @prop declare inputClassName?: string;
  @prop declare value?: TextareaHTMLAttributes<HTMLTextAreaElement>['value'];
  @prop declare size?: FieldSize;

  render(): ReactNode {
    const {
      label: _label,
      error: _error,
      className: _className,
      inputClassName: _inputClassName,
      value: _value,
      size: _size,
      ...props
    } = this.props as Record<string, any>;
    const label = this.label;
    const error = this.error;
    const className = this.className ?? '';
    const inputClassName = this.inputClassName ?? '';
    const value = this.value;
    const size = this.size ?? FieldSize.MD;

    // `h-auto`: a text area is as tall as its `rows`, never less than the minimum. Without it the
    // single-line height every field carries stayed on, and `rows` changed nothing on any screen.
    return (
      <div className={`fc-field-stack w-full ${className}`}>
        {label && <label className={UiFieldUtils.TEXT.LABEL}>{label}</label>}
        <div className="fc-field-wrap">
          <textarea
            {...props}
            value={value}
            aria-invalid={error ? true : undefined}
            className={`${UiFieldUtils.getFieldClasses(size, `resize-none h-auto min-h-[100px] ${inputClassName}`)} ${error ? 'fc-field--error' : ''}`}
          />
          {error ? <FieldErrorMark message={error} /> : null}
        </div>
      </div>
    );
  }
}
