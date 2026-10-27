import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PersonFieldWords } from '@/app/users/people/fields/person-field-words';
import type { IPersonFieldDefinition } from '@/app/users/people/fields/interfaces/person-field.interface';

/**
 * Built-in picker of one of the site's person fields (People → Person fields). A plugin field that means
 * "where does this answer go" sets `admin.component: 'PersonFieldPicker'` and stores the field key; the
 * options are whatever the operator declared, so a new field is pickable without a plugin release.
 */
export class PersonFieldPicker extends Reactor {
  @prop declare value?: string;
  @prop declare onChange?: (value: string) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  @state fields: IPersonFieldDefinition[] = [];
  @state loaded = false;

  componentDidMount(): void {
    AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELDS)
      .then((response) => { this.fields = response?.docs ?? []; })
      .catch(() => { this.fields = []; })
      .finally(() => { this.loaded = true; });
  }

  render(): ReactNode {
    const { value, theme, disabled, field, fields, loaded } = this;
    const readOnly = Boolean(field?.admin?.readOnly) || disabled;
    // A key the site no longer declares stays visible, so the operator sees what is stored and can change it.
    const missing = value && loaded && !fields.some((candidate) => candidate.key === value);
    const options = [
      { value: '', label: AdminI18n.t('ui.personFieldPicker.none') },
      ...fields.map((candidate) => ({ value: candidate.key, label: `${PersonFieldWords.pick(candidate.label, candidate.key)} · ${candidate.key}` })),
      ...(missing ? [{ value: String(value), label: AdminI18n.t('ui.personFieldPicker.missing', { key: value }) }] : []),
    ];
    return (
      <div className="space-y-1.5">
        <Select value={value || ''} onChange={(next: string) => this.onChange?.(next)} options={options} theme={theme}
          disabled={readOnly || !loaded} placeholder={AdminI18n.t('ui.personFieldPicker.none')} />
        <AdminLink href={AdminConstants.ROUTES.PEOPLE.FIELDS} className="text-[11px] font-bold text-indigo-600">{AdminI18n.t('ui.personFieldPicker.manage')}</AdminLink>
      </div>
    );
  }
}
