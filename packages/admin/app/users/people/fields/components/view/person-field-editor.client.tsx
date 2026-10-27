import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { BooleanToggleField } from '@/components/ui/view/boolean-toggle-field.client';
import type { IPersonFieldDefinition } from '@/app/users/people/fields/interfaces/person-field.interface';
import type { ISystemLocaleOption } from '@/components/collection/fields/interfaces/system-locale-option.interface';

/** Declares one person field: its key, type, words per site language, options and who may set it. */
export class PersonFieldEditor extends Reactor {
  declare props: Pick<PersonFieldEditor, 'field' | 'locales' | 'theme' | 'onSaved' | 'onCancel'>;

  static readonly TYPES = ['text', 'longText', 'number', 'boolean', 'date', 'time', 'datetime', 'place', 'choice', 'choices'];

  @prop declare field: IPersonFieldDefinition | null;
  @prop declare locales: ISystemLocaleOption[];
  @prop declare theme: ThemeMode;
  @prop declare onSaved: () => void;
  @prop declare onCancel: () => void;

  @state draft: IPersonFieldDefinition = { key: '', label: {}, type: 'text', options: [], description: {}, selfEditable: false, sortOrder: 0 };
  @state saving = false;
  @state error = '';

  componentDidMount(): void {
    if (this.field) this.draft = { ...this.field, options: this.field.options.map((option) => ({ ...option, label: { ...option.label } })) };
  }

  private change(change: Partial<IPersonFieldDefinition>): void {
    this.draft = { ...this.draft, ...change };
  }

  private async save(): Promise<void> {
    this.saving = true;
    this.error = '';
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELDS, this.draft);
      this.onSaved();
    } catch (error: any) {
      this.error = error?.data?.field === 'key' ? AdminI18n.t('users.fields.keyRule') : (error?.message || AdminI18n.t('users.fields.saveFailed'));
    } finally {
      this.saving = false;
    }
  }

  private words(label: string, value: Record<string, string>, onChange: (next: Record<string, string>) => void): ReactNode {
    return (
      <div className="space-y-2">
        <span className="block text-[11px] font-bold tracking-tight text-slate-500">{label}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {this.locales.map((locale) => (
            <Input key={locale.value} label={locale.label} value={value[locale.value] ?? ''} disabled={this.saving}
              onChange={(event) => onChange({ ...value, [locale.value]: event.target.value })} />
          ))}
        </div>
      </div>
    );
  }

  private options(): ReactNode {
    const options = this.draft.options;
    const set = (index: number, change: Partial<(typeof options)[number]>) =>
      this.change({ options: options.map((option, at) => (at === index ? { ...option, ...change } : option)) });
    return (
      <div className="space-y-3">
        <span className="block text-[11px] font-bold tracking-tight text-slate-500">{AdminI18n.t('users.fields.options')}</span>
        {options.map((option, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3">
            <Input label={AdminI18n.t('users.fields.optionKey')} value={option.key} onChange={(event) => set(index, { key: event.target.value })} />
            {this.locales.map((locale) => (
              <Input key={locale.value} label={locale.label} value={option.label[locale.value] ?? ''}
                onChange={(event) => set(index, { label: { ...option.label, [locale.value]: event.target.value } })} />
            ))}
            <Button variant={ButtonVariant.SECONDARY} type="button" icon={<FrameworkIcons.Trash size={14} />} className="h-10 px-3 rounded-xl"
              onClick={() => this.change({ options: options.filter((_, at) => at !== index) })}>{AdminI18n.t('users.fields.removeOption')}</Button>
          </div>
        ))}
        <Button variant={ButtonVariant.SECONDARY} type="button" icon={<FrameworkIcons.Plus size={14} />} className="h-9 px-4 rounded-xl text-[12px] font-bold"
          onClick={() => this.change({ options: [...options, { key: '', label: {} }] })}>{AdminI18n.t('users.fields.addOption')}</Button>
      </div>
    );
  }

  render(): ReactNode {
    const { draft, theme, saving } = this;
    const dark = theme === ThemeMode.DARK;
    const hasOptions = draft.type === 'choice' || draft.type === 'choices';
    return (
      <div className={`${AdminClass.SURFACE} p-8 space-y-5 ${dark ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
        {this.error ? <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-[12px] font-bold dark:bg-rose-500/10">{this.error}</div> : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input label={AdminI18n.t('users.fields.key')} value={draft.key} disabled={saving || Boolean(this.field)}
            onChange={(event) => this.change({ key: event.target.value })} />
          <Select label={AdminI18n.t('users.fields.type')} value={draft.type} theme={theme} disabled={saving}
            options={PersonFieldEditor.TYPES.map((type) => ({ value: type, label: AdminI18n.t(`users.fields.types.${type}`) }))}
            onChange={(type) => this.change({ type })} />
        </div>
        <p className="-mt-3 text-[11px] text-slate-400">{AdminI18n.t('users.fields.keyHint')}</p>
        {this.words(AdminI18n.t('users.fields.label'), draft.label, (label) => this.change({ label }))}
        {this.words(AdminI18n.t('users.fields.description'), draft.description, (description) => this.change({ description }))}
        {hasOptions ? this.options() : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="block"><span className="block text-[11px] font-bold tracking-tight text-slate-500 mb-1.5">{AdminI18n.t('users.fields.selfEditable')}</span>
            <BooleanToggleField checked={draft.selfEditable} theme={theme} disabled={saving} onChange={(selfEditable) => this.change({ selfEditable })} /></label>
          <Input label={AdminI18n.t('users.fields.sortOrder')} type="number" value={String(draft.sortOrder)} disabled={saving}
            onChange={(event) => this.change({ sortOrder: Number(event.target.value) || 0 })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant={ButtonVariant.PRIMARY} type="button" isLoading={saving} onClick={() => void this.save()}
            className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px]">{AdminI18n.t('users.fields.saveField')}</Button>
          <Button variant={ButtonVariant.SECONDARY} type="button" onClick={() => this.onCancel()}
            className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px]">{AdminI18n.t('users.cancel')}</Button>
        </div>
      </div>
    );
  }
}
