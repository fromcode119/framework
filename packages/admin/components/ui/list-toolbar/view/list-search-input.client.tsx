import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

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

  private get inputClass(): string {
    return this.theme === ThemeMode.DARK
      ? 'bg-slate-900/50 border-slate-800 focus:border-indigo-500/50 focus:bg-slate-900 text-white shadow-2xl shadow-black/40'
      : 'bg-white border-slate-200 focus:border-indigo-500 shadow-xl shadow-slate-200/50 text-slate-900';
  }

  render(): ReactNode {
    return (
      <div className="relative group flex-1 min-w-0">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <FrameworkIcons.Search size={18} />
        </div>
        <input
          type="text"
          placeholder={this.placeholder}
          value={this.value}
          onChange={this.handleChange}
          className={`w-full h-11 pl-12 pr-4 rounded-xl border transition-all text-sm font-semibold outline-none text-ellipsis ${this.inputClass}`}
        />
      </div>
    );
  }
}
