import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { PureReactor, prop, ref } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { UiFieldUtils } from '@/lib/ui';

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
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {this.label && <label className={UiFieldUtils.TEXT.LABEL}>{this.label}</label>}
        <input
          ref={this.elementRef}
          {...this.rest}
          value={this.normalizedValue}
          className={`${UiFieldUtils.getFieldClasses(size, inputClassName)}
            ${error ? '!border-rose-500 focus:!border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 animate-shake shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}
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
