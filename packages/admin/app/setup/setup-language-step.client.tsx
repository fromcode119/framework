import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * Step one: the language the console speaks.
 *
 * The choices are the dictionaries the admin bundle ships, named in their own language, so this list
 * cannot claim a language the console has no words for. Over forty of them, so a searchable list
 * rather than a box per language.
 */
export class SetupLanguageStep extends PureReactor {
  @prop declare locale: string;
  @prop declare onLocaleChange: (locale: string) => void;

  render(): ReactNode {
    return (
      <div className="space-y-4">
        <p className="fc-size-xs fc-tone-muted font-medium leading-relaxed">
          {AdminDictionary.translate(this.locale, 'setup.language.help')}
        </p>
        <Select
          searchable
          value={this.locale}
          onChange={this.onLocaleChange}
          options={AdminDictionary.locales.map((option) => ({ value: option, label: AdminDictionary.label(option) }))}
        />
      </div>
    );
  }
}
