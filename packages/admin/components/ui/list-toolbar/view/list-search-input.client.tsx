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
      <div className="fc-search relative flex-1 min-w-0">
        <div className="fc-search__icon">
          <FrameworkIcons.Search size={15} />
        </div>
        <input
          type="text"
          placeholder={this.placeholder}
          value={this.value}
          onChange={this.handleChange}
          // The same box as every other field; `fc-search-field` opens the room on the left for the
          // icon. The inset must live in a compound `.fc-field.fc-search-field` rule: `.fc-field`'s own
          // `padding` shorthand overrides any `ps-*`/`px-*` utility, so a utility here is dead.
          className={UiFieldUtils.getFieldClasses(FieldSize.MD, 'fc-search-field text-ellipsis')}
        />
      </div>
    );
  }
}
