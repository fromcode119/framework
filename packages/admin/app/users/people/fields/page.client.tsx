import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactElement } from 'react';
import { state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Button } from '@/components/ui/view/button.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { Loader } from '@/components/ui/view/loader.client';
import { SiteRequiredNotice } from '@/components/view/site-required-notice.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { SystemLocaleOptionsService } from '@/components/collection/fields/system-locale-options-service';
import type { ISystemLocaleOption } from '@/components/collection/fields/interfaces/system-locale-option.interface';
import { PersonFieldEditor } from '@/app/users/people/fields/components/view/person-field-editor.client';
import { PersonFieldWords } from '@/app/users/people/fields/person-field-words';
import type { IPersonFieldDefinition } from '@/app/users/people/fields/interfaces/person-field.interface';

/**
 * People → Person fields. What the site knows about a person beyond name and contact — a birth name, a
 * favourite colour, a skill level — declared once here, then filled on each person's page, by a plugin,
 * or by the person themselves in an app when the field is open to them.
 */
export class PersonFieldsPage extends AdminComponent {
  @state fields: IPersonFieldDefinition[] = [];
  @state locales: ISystemLocaleOption[] = [];
  @state loading = true;
  @state error = '';
  /** The field open in the editor; `null` with `editing` set is a new field. */
  @state editing = false;
  @state current: IPersonFieldDefinition | null = null;
  @state removing: IPersonFieldDefinition | null = null;
  @state deleting = false;

  componentDidMount(): void {
    void this.load();
    AdminSystemSettingsClient.getAll()
      .then((settings) => { this.locales = SystemLocaleOptionsService.fromSettings(settings); })
      .catch(() => { this.locales = SystemLocaleOptionsService.fallback(); });
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.fields = (await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELDS))?.docs ?? [];
      this.error = '';
    } catch (error: any) {
      this.error = error?.message || AdminI18n.t('users.fields.loadFailed');
    } finally {
      this.loading = false;
    }
  }

  private open(field: IPersonFieldDefinition | null): void {
    this.current = field;
    this.editing = true;
  }

  private async remove(): Promise<void> {
    if (!this.removing) return;
    this.deleting = true;
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.PERSON_FIELD(this.removing.key));
      this.removing = null;
      await this.load();
    } finally {
      this.deleting = false;
    }
  }

  private columns(): any[] {
    return [
      { header: AdminI18n.t('users.fields.label'), id: 'label', accessor: (field: IPersonFieldDefinition) => (
        <div>
          <div className="font-bold tracking-tight">{PersonFieldWords.pick(field.label, field.key)}</div>
          <div className="text-[11px] font-mono text-slate-500">{field.key}</div>
        </div>
      ) },
      { header: AdminI18n.t('users.fields.type'), id: 'type', accessor: (field: IPersonFieldDefinition) => AdminI18n.t(`users.fields.types.${field.type}`) },
      { header: AdminI18n.t('users.fields.selfEditable'), id: 'selfEditable', accessor: (field: IPersonFieldDefinition) =>
        AdminI18n.t(field.selfEditable ? 'common.yes' : 'common.no') },
      { header: AdminI18n.t('users.fields.description'), id: 'description', accessor: (field: IPersonFieldDefinition) =>
        <span className="text-[12px] text-slate-500">{PersonFieldWords.pick(field.description, '—')}</span> },
    ];
  }

  render(): ReactElement {
    const theme = this.theme;
    return (
      <SiteRequiredNotice subject="people">
        <div className="w-full min-h-screen flex flex-col">
          <CompactPageHeader theme={theme.value} backHref={AdminConstants.ROUTES.PEOPLE.ROOT}
            icon={<FrameworkIcons.ListChecks size={18} strokeWidth={2} />}
            title={AdminI18n.t('users.fields.title')} subtitle={AdminI18n.t('users.fields.subtitle')}
            actions={this.editing ? null : (
              <Button variant={ButtonVariant.PRIMARY} type="button" icon={<FrameworkIcons.Plus size={14} />} onClick={() => this.open(null)}
                className="h-9 px-4 rounded-xl font-bold text-[12px]">{AdminI18n.t('users.fields.add')}</Button>
            )} />
          <div className="flex-1 w-full px-6 lg:px-12 py-10 space-y-6">
            {this.error ? <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-[12px] font-bold dark:bg-rose-500/10">{this.error}</div> : null}
            {this.editing ? (
              <PersonFieldEditor key={this.current?.key ?? 'new'} field={this.current} locales={this.locales} theme={theme}
                onCancel={() => { this.editing = false; }}
                onSaved={() => { this.editing = false; void this.load(); }} />
            ) : null}
            {this.loading ? <Loader label={AdminI18n.t('users.fields.loading')} /> : (
              <DataTable columns={this.columns()} data={this.fields.map((field) => ({ ...field, id: field.key }))} loading={false} emptyMessage={AdminI18n.t('users.fields.empty')}
                onRowClick={(field: IPersonFieldDefinition) => this.open(field)}
                actions={(field: IPersonFieldDefinition) => (
                  <Button variant={ButtonVariant.SECONDARY} type="button" icon={<FrameworkIcons.Trash size={14} />}
                    onClick={() => { this.removing = field; }} className="h-8 px-3 rounded-lg text-[11px] font-bold">{AdminI18n.t('users.fields.delete')}</Button>
                )} />
            )}
          </div>
          <ConfirmDialog isOpen={Boolean(this.removing)} onClose={() => { this.removing = null; }} onConfirm={() => void this.remove()}
            title={AdminI18n.t('users.fields.deleteTitle')}
            description={AdminI18n.t('users.fields.deleteBody', { name: this.removing ? PersonFieldWords.pick(this.removing.label, this.removing.key) : '' })}
            confirmLabel={AdminI18n.t('users.fields.delete')} variant={ButtonVariant.DANGER} isLoading={this.deleting} />
        </div>
      </SiteRequiredNotice>
    );
  }
}
