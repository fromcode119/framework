import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminLink } from '@/components/view/admin-link.client';
import { Button } from '@/components/ui/view/button.client';
import { PersonFieldControl } from '@/app/users/people/fields/components/view/person-field-control.client';
import { PersonFieldWords } from '@/app/users/people/fields/person-field-words';
import type { IPersonFieldDefinition } from '@/app/users/people/fields/interfaces/person-field.interface';

/**
 * The person's values for the site's person fields — what they answered in an app, or what the operator
 * set here. Every field declared under People → Person fields appears, with the control its type implies.
 */
export class PersonFieldsPanel extends Reactor {
  declare props: Pick<PersonFieldsPanel, 'personId' | 'theme'>;

  @prop declare personId: string | number;
  @prop declare theme: ThemeMode;

  @state fields: IPersonFieldDefinition[] = [];
  @state values: Record<string, string | number | boolean | string[] | null> = {};
  @state loading = true;
  @state saving = false;
  @state error = '';
  @state notice = '';

  componentDidMount(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [fields, values] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELDS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELD_VALUES(this.personId)),
      ]);
      this.fields = fields?.docs ?? [];
      this.values = values?.values ?? {};
    } catch (error: any) {
      this.error = error?.message || AdminI18n.t('users.fields.loadFailed');
    } finally {
      this.loading = false;
    }
  }

  private async save(): Promise<void> {
    this.saving = true;
    this.error = '';
    this.notice = '';
    try {
      const payload = Object.fromEntries(this.fields.map((field) => [field.key, this.values[field.key] ?? null]));
      const result = await AdminApi.patch(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELD_VALUES(this.personId), { values: payload });
      this.values = result?.values ?? {};
      this.notice = AdminI18n.t('users.fields.saved');
    } catch (error: any) {
      const field = this.fields.find((candidate) => candidate.key === error?.data?.field);
      this.error = field ? AdminI18n.t('users.fields.invalidValue', { field: PersonFieldWords.pick(field.label, field.key) }) : (error?.message || AdminI18n.t('users.fields.saveFailed'));
    } finally {
      this.saving = false;
    }
  }

  private body(): ReactNode {
    if (this.loading) return <p className="text-[12px] text-slate-400">{AdminI18n.t('users.fields.loading')}</p>;
    if (!this.fields.length) {
      return (
        <p className="text-[12px] text-slate-400">
          {AdminI18n.t('users.fields.noneDeclared')}{' '}
          <AdminLink href={AdminConstants.ROUTES.PEOPLE.FIELDS} className="text-indigo-600 font-bold">{AdminI18n.t('users.fields.declare')}</AdminLink>
        </p>
      );
    }
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {this.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="block text-[11px] font-bold tracking-tight text-slate-500 mb-1.5">{PersonFieldWords.pick(field.label, field.key)}</span>
              <PersonFieldControl field={field} value={this.values[field.key] ?? null} disabled={this.saving} theme={this.theme}
                onChange={(value) => { this.values = { ...this.values, [field.key]: value }; }} />
              {PersonFieldWords.pick(field.description) ? <span className="block text-[11px] text-slate-400 mt-1">{PersonFieldWords.pick(field.description)}</span> : null}
            </label>
          ))}
        </div>
        <Button variant={ButtonVariant.PRIMARY} type="button" isLoading={this.saving} onClick={() => void this.save()}
          className="h-10 px-6 rounded-xl font-bold tracking-tight text-[12px]">{AdminI18n.t('users.fields.save')}</Button>
      </>
    );
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className={`mt-6 ${AdminClass.SURFACE} p-8 space-y-5 ${dark ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className={`text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{AdminI18n.t('users.fields.title')}</h3>
          <AdminLink href={AdminConstants.ROUTES.PEOPLE.FIELDS} className="text-[11px] font-bold text-indigo-600">{AdminI18n.t('users.fields.manage')}</AdminLink>
        </div>
        {this.error ? <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-[12px] font-bold dark:bg-rose-500/10">{this.error}</div> : null}
        {this.notice ? <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-2.5 text-[12px] font-bold dark:bg-emerald-500/10">{this.notice}</div> : null}
        {this.body()}
      </div>
    );
  }
}
