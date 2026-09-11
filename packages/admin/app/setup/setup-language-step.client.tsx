import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * Step one: the language the console speaks.
 *
 * The choices are the dictionaries the admin bundle ships, named in their own language, so this list
 * cannot claim a language the console has no words for.
 */
export class SetupLanguageStep extends PureReactor {
  @prop declare locale: string;
  @prop declare onLocaleChange: (locale: string) => void;

  @bound
  private handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
    this.onLocaleChange(event.currentTarget.value);
  }

  private optionClass(option: string): string {
    const selected = option === this.locale;
    return [
      'w-full flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition-colors',
      selected
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300',
    ].join(' ');
  }

  render(): ReactNode {
    return (
      <div className="space-y-4">
        <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
          {AdminDictionary.translate(this.locale, 'setup.language.help')}
        </p>
        <div className="space-y-2">
          {AdminDictionary.locales.map((option) => (
            <button key={option} type="button" value={option} onClick={this.handleClick} className={this.optionClass(option)}>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{AdminDictionary.label(option)}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{option}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
}
