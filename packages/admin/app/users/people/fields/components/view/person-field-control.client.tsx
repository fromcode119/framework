import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { Select } from '@/components/ui/view/select.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { BooleanToggleField } from '@/components/ui/view/boolean-toggle-field.client';
import { PersonFieldWords } from '@/app/users/people/fields/person-field-words';
import type { IPersonFieldDefinition } from '@/app/users/people/fields/interfaces/person-field.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** One person field's control, chosen by its type — the same types an app draws its inputs from. */
export class PersonFieldControl extends PureReactor {
  declare props: Pick<PersonFieldControl, 'field' | 'value' | 'onChange' | 'disabled' | 'theme'>;

  @prop declare field: IPersonFieldDefinition;
  @prop declare value: string | number | boolean | string[] | null;
  @prop declare onChange: (value: string | number | boolean | string[] | null) => void;
  @prop declare disabled?: boolean;
  @prop declare theme?: ThemeMode;

  private text(type: string): ReactNode {
    return <Input type={type} value={this.value == null ? '' : String(this.value)} disabled={this.disabled}
      onChange={(event) => this.onChange(event.target.value)} />;
  }

  private static localDateTime(value: string | number | boolean | string[] | null): string {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private choices(): ReactNode {
    const picked = Array.isArray(this.value) ? this.value : [];
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        {this.field.options.map((option) => (
          <Checkbox key={option.key} checked={picked.includes(option.key)} disabled={this.disabled}
            label={PersonFieldWords.pick(option.label, option.key)}
            onChange={(checked: boolean) => this.onChange(checked ? [...picked, option.key] : picked.filter((key) => key !== option.key))} />
        ))}
      </div>
    );
  }

  render(): ReactNode {
    const { field, value, theme, disabled } = this;
    switch (field.type) {
      case 'longText':
        return <TextArea value={value == null ? '' : String(value)} disabled={disabled} rows={4} onChange={(event) => this.onChange(event.target.value)} />;
      case 'number': return this.text('number');
      case 'date': return this.text('date');
      case 'time': return this.text('time');
      case 'datetime':
        // Stored as an ISO instant; the input speaks the reader's local wall time.
        return <Input type="datetime-local" value={PersonFieldControl.localDateTime(value)} disabled={disabled}
          onChange={(event) => this.onChange(event.target.value ? new Date(event.target.value).toISOString() : null)} />;
      case 'boolean':
        return <BooleanToggleField checked={value === true} disabled={disabled} theme={theme} onChange={(checked) => this.onChange(checked)} />;
      case 'choice':
        return <Select value={value == null ? '' : String(value)} disabled={disabled} theme={theme} placeholder={AdminI18n.t('users.fields.notSet')}
          options={[{ value: '', label: AdminI18n.t('users.fields.notSet') }, ...field.options.map((option) => ({ value: option.key, label: PersonFieldWords.pick(option.label, option.key) }))]}
          onChange={(next) => this.onChange(next || null)} />;
      case 'choices': return this.choices();
      default: return this.text('text');
    }
  }
}
