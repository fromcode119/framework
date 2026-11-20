import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { UiFieldUtils } from '@/lib/ui';
import { AdminClass } from '@/lib/admin-class';

/**
 * The console's search field: the glass inside the field, the words after it. Every screen that
 * searches uses this one — six screens had each placed an icon over an `Input` and opened room for it
 * with a padding utility that the field's own padding overrode, so the glass sat on the words.
 */
export class SearchField extends PureReactor {
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare placeholder?: string;
  @prop declare className?: string;
  @prop declare autoFocus?: boolean;

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    this.onChange(event.target.value);
  }

  render(): ReactNode {
    const name = AdminClass.of('search');
    return (
      <div className={`${name} ${this.className ?? ''}`}>
        <div className={`${name}__icon`}><FrameworkIcons.Search size={15} /></div>
        <input
          type="text"
          autoFocus={this.autoFocus}
          placeholder={this.placeholder}
          aria-label={this.placeholder}
          value={this.value}
          onChange={this.change}
          className={UiFieldUtils.getFieldClasses(FieldSize.MD, `${name}-field text-ellipsis`)}
        />
      </div>
    );
  }
}
