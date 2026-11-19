import { Loader } from '@/components/ui/view/loader.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Label } from '@/components/ui/view/label.client';
import { Hint } from '@/components/ui/view/hint.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Alert } from '@/components/ui/view/alert.client';
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
    if (this.loading) return <Loader label={AdminI18n.t('users.fields.loading')} />;
    if (!this.fields.length) {
      return <EmptyState inline title={AdminI18n.t('users.fields.noneDeclared')} action={<Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={AdminConstants.ROUTES.PEOPLE.FIELDS}>{AdminI18n.t('users.fields.declare')}</Button>} />;
    }
    return (
      <>
        <div className="fc-form-grid">
          {this.fields.map((field) => (
            <div key={field.key} className="fc-field-stack">
              <Label>{PersonFieldWords.pick(field.label, field.key)}</Label>
              <PersonFieldControl field={field} value={this.values[field.key] ?? null} disabled={this.saving} theme={this.theme}
                onChange={(value) => { this.values = { ...this.values, [field.key]: value }; }} />
              {PersonFieldWords.pick(field.description) ? <Hint>{PersonFieldWords.pick(field.description)}</Hint> : null}
            </div>
          ))}
        </div>
        <div><Button variant={ButtonVariant.PRIMARY} type="button" isLoading={this.saving} onClick={() => void this.save()}>{AdminI18n.t('users.fields.save')}</Button></div>
      </>
    );
  }

  render(): ReactNode {
    return (
      <RecordCard title={AdminI18n.t('users.fields.title')} aside={<div className="fc-record-card__table-tools"><Button variant={ButtonVariant.GHOST} as={AdminLink} href={AdminConstants.ROUTES.PEOPLE.FIELDS}>{AdminI18n.t('users.fields.manage')}</Button></div>}>
        <div className="fc-stack">
          {this.error ? <Alert tone="danger">{this.error}</Alert> : null}
          {this.notice ? <Alert tone="success">{this.notice}</Alert> : null}
          {this.body()}
        </div>
      </RecordCard>
    );
  }
}
