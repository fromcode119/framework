import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode, TextareaHTMLAttributes } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
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

    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {label && <label className={UiFieldUtils.TEXT.LABEL}>{label}</label>}
        <textarea
          {...props}
          value={value}
          className={`${UiFieldUtils.getFieldClasses(size, `resize-none min-h-[100px] ${inputClassName}`)}
            ${error ? 'border-rose-500 focus:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}
        />
        {error && (
          <div className="flex items-center gap-2 px-1 animate-fade-in-up">
            <span className={UiFieldUtils.TEXT.ERROR}>
              {error}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-rose-500/20 to-transparent" />
          </div>
        )}
      </div>
    );
  }
}
