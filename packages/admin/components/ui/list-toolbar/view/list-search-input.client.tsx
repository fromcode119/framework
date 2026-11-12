import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { UiFieldUtils } from '@/lib/ui';

/** The search field at the head of a list. It filters as you type; the list decides what it matches. */
export class ListSearchInput extends PureReactor {
  declare props: Pick<ListSearchInput, 'value' | 'onSearch' | 'placeholder' | 'theme'>;

  @prop declare value: string;
  @prop declare onSearch: (value: string) => void;
  @prop declare placeholder: string;
  @prop declare theme: ThemeMode;

  @bound private handleChange(event: ChangeEvent<HTMLInputElement>): void {
    this.onSearch(event.target.value);
  }

  render(): ReactNode {
    return (
      <div className="relative group flex-1 min-w-0">
        <div className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <FrameworkIcons.Search size={15} />
        </div>
        <input
          type="text"
          placeholder={this.placeholder}
          value={this.value}
          onChange={this.handleChange}
          // The same box as every other field; only the room for the icon is its own.
          className={UiFieldUtils.getFieldClasses(FieldSize.MD, 'ps-10 pe-4 text-ellipsis')}
        />
      </div>
    );
  }
}
