import { ThemeMode } from '@fromcode119/core/client';
import type { ComponentType, ReactNode, SetStateAction } from 'react';

import { PureReactor, bound, prop, state } from '@fromcode119/react-class-components';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Select } from '@/components/ui/view/select.client';
import { TagFieldChips } from '@/components/ui/tag-field/view/chips.client';
import type { IOption } from '@/components/ui/interfaces/option.interface';
import { SettingRow } from '@/app/settings/security/setting-row';
import { SettingListValue } from '@/app/settings/security/setting-list-value';
import type { SettingListSeparator } from '@/app/settings/security/enums/setting-list-separator.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A setting that holds a list — addresses, paths, tool names, countries, tables — shown as one chip per
 * entry rather than a delimited string in a text box. Type an entry and press Enter to add it, or, where
 * the list has known values (`options`), pick one by name; the chip says the name with the stored value
 * under it. Stored exactly as before, in the separator the setting's readers expect.
 */
export class SettingListRow extends PureReactor {
  declare props: Pick<SettingListRow, 'settings' | 'setSettings' | 'settingKey' | 'separator' | 'icon' | 'title' | 'description' | 'theme' | 'placeholder' | 'options' | 'uppercase'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare settingKey: string;
  @prop declare separator: SettingListSeparator;
  @prop declare icon: ComponentType<{ size?: number }>;
  @prop declare title: ReactNode;
  @prop declare description: ReactNode;
  @prop declare theme: ThemeMode;
  @prop declare placeholder?: string;
  /** Known values, picked by name; entries outside it can still be typed. */
  @prop declare options?: IOption[];
  /** Entries are codes stored in capitals (country codes). */
  @prop declare uppercase?: boolean;

  @state input = '';

  private get entries(): string[] {
    return SettingListValue.parse(this.settings[this.settingKey] ?? '');
  }

  private write(entries: string[]): void {
    const key = this.settingKey;
    const value = SettingListValue.join(entries, this.separator);
    this.setSettings((prev) => ({ ...prev, [key]: value }));
  }

  @bound
  change(next: string[] | string): void {
    this.write(Array.isArray(next) ? next : []);
  }

  @bound
  add(raw: unknown): void {
    const text = String(raw ?? '').trim();
    const entry = this.uppercase ? text.toUpperCase() : text;
    if (entry) this.write([...this.entries, entry]);
    this.input = '';
  }

  @bound
  typed(value: string): void {
    this.input = value;
  }

  @bound
  noSuggestions(): void {}

  render(): ReactNode {
    const entries = this.entries;
    const options = this.options ?? [];
    const labels = Object.fromEntries(options.map((option) => [option.value, option.label]));
    const remaining = options.filter((option) => !entries.includes(option.value));
    return (
      <SettingRow theme={this.theme} icon={this.icon} title={this.title} description={this.description} wide>
        <div className="space-y-2 max-w-3xl">
          {options.length ? (
            <Select
              value=""
              onChange={this.add}
              options={remaining}
              placeholder={AdminI18n.t('settings.security.listPick')}
              searchable
              theme={this.theme}
            />
          ) : null}
          <TagFieldChips
            theme={this.theme}
            size={FieldSize.MD}
            tags={entries}
            labels={labels}
            hasMany
            isCreating={false}
            inputValue={this.input}
            effectivePlaceholder={this.placeholder ?? AdminI18n.t('settings.security.listTypeAndEnter')}
            onChange={this.change}
            onInputChange={this.typed}
            onShowSuggestions={this.noSuggestions}
            onAdd={this.add}
          />
        </div>
      </SettingRow>
    );
  }
}
