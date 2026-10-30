import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationFieldInput } from '@/app/settings/integrations/integration-field-input';
import { IntegrationSetupAddresses } from '@/app/settings/integrations/integration-setup-addresses';
import type { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A provider's form, submitted by the page header's Save.
 *
 * A one-provider type shows it as the type's whole page: what is in use now, the provider choice, and the
 * chosen provider's fields. A type with several shows it in place of its list, for one provider, with a way
 * back and Remove at the bottom.
 */
export class IntegrationProviderEditor extends PureReactor {
  static readonly FORM_ID = 'integration-provider-form';

  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationProviderEditor, 'activeIntegration' | 'editor' | 'currentProviderDefinition' | 'fieldOptionsService' | 'dynamicFieldOptions' | 'dynamicFieldErrors' | 'dynamicFieldLoading' | 'patchEditor' | 'onSubmit' | 'onChooseProvider' | 'onBack' | 'canRemove' | 'confirmingRemove' | 'removing' | 'onRequestRemove' | 'onCancelRemove' | 'onConfirmRemove'>;

  @prop declare activeIntegration: IIntegrationRecord;
  @prop declare editor: IProviderEditorState;
  @prop declare currentProviderDefinition: IIntegrationProvider | null;
  @prop declare fieldOptionsService: IntegrationsFieldOptionsService;
  @prop declare dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  @prop declare dynamicFieldErrors: Record<string, string>;
  @prop declare dynamicFieldLoading: Record<string, boolean>;
  @prop declare patchEditor: (
    patch: Partial<IProviderEditorState> | ((prev: IProviderEditorState) => IProviderEditorState)
  ) => void;
  @prop declare onSubmit: () => void;
  /** The provider choice: replaces the editor with that provider's saved values or its defaults. */
  @prop declare onChooseProvider: (providerKey: string) => void;
  @prop declare onBack: () => void;
  /** False for the last saved provider: the api keeps at least one. */
  @prop declare canRemove: boolean;
  @prop declare confirmingRemove: boolean;
  @prop declare removing: boolean;
  @prop declare onRequestRemove: () => void;
  @prop declare onCancelRemove: () => void;
  @prop declare onConfirmRemove: () => void;

  private get single(): boolean {
    return !this.activeIntegration.allowMultipleActiveProviders;
  }

  private get fields(): IIntegrationConfigField[] {
    return this.currentProviderDefinition?.fields || [];
  }

  private get providerOptions(): Array<{ label: string; value: string }> {
    return this.activeIntegration.providers.map((provider) => ({ label: provider.label, value: provider.key }));
  }

  @bound
  private handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    this.onSubmit();
  }

  @bound
  private handleProviderNameChange(event: ChangeEvent<HTMLInputElement>): void {
    const providerName = event.target.value;
    this.patchEditor((previous) => ({ ...previous, providerName }));
  }

  private setFieldValue(field: IIntegrationConfigField, nextValue: any): void {
    this.patchEditor((previous) => ({
      ...previous,
      preservedSecretFields: field.type === IntegrationFieldType.PASSWORD
        ? { ...previous.preservedSecretFields, [field.name]: false }
        : previous.preservedSecretFields,
      config: { ...previous.config, [field.name]: nextValue },
    }));
  }

  /** What the type runs on right now, and where that came from. Read only: it follows what is saved. */
  private statusText(): string {
    const active = this.activeIntegration.active;
    if (!active?.provider) return AdminI18n.t('settings.integrations.statusNothingInUse');
    const label = this.activeIntegration.providers.find((provider) => provider.key === active.provider)?.label || active.provider;
    const source = String((active.source as any)?.value ?? active.source ?? '');
    const sourceText = source === 'stored'
      ? AdminI18n.t('settings.integrations.sourceStored')
      : source === 'env'
        ? AdminI18n.t('settings.integrations.sourceEnv')
        : AdminI18n.t('settings.integrations.sourceDefault');
    return AdminI18n.t('settings.integrations.statusInUse', { provider: label, source: sourceText });
  }

  private renderStatus(): ReactNode {
    return (
      <div className="md:col-span-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">{AdminI18n.t('settings.integrations.status')}</span>
          <span className="inline-flex h-6 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-semibold tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <FrameworkIcons.Lock size={10} />
            {AdminI18n.t('ui.field.readOnly')}
          </span>
        </div>
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{this.statusText()}</p>
      </div>
    );
  }

  private renderProviderChoice(): ReactNode {
    return (
      <div>
        <Select value={this.editor.providerKey} onChange={this.onChooseProvider} options={this.providerOptions}
          label={AdminI18n.t('settings.integrations.provider')} searchable={false} size={FieldSize.MD} />
        {this.single ? <p className="mt-1 text-[11px] text-slate-500">{AdminI18n.t('settings.integrations.oneProviderAtATime')}</p> : null}
      </div>
    );
  }

  private renderFields(): ReactNode {
    return this.fields.map((field) => (
      <IntegrationFieldInput
        key={field.name}
        field={field}
        editor={this.editor}
        fieldOptionsService={this.fieldOptionsService}
        dynamicFieldOptions={this.dynamicFieldOptions}
        dynamicFieldErrors={this.dynamicFieldErrors}
        dynamicFieldLoading={this.dynamicFieldLoading}
        onChange={(nextValue: any) => this.setFieldValue(field, nextValue)}
      />
    ));
  }

  private renderRemove(): ReactNode {
    if (this.single || this.editor.isNew) return null;
    if (!this.canRemove) {
      return <p className="border-t border-slate-100 pt-4 text-[12px] text-slate-500 dark:border-slate-800">{AdminI18n.t('settings.integrations.removeLastRefused')}</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        {this.confirmingRemove ? (
          <>
            <button type="button" onClick={this.onConfirmRemove} disabled={this.removing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-600 bg-rose-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50">
              {this.removing ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Trash size={14} />}
              {AdminI18n.t('settings.integrations.removeProvider')}
            </button>
            <button type="button" onClick={this.onCancelRemove}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {AdminI18n.t('settings.integrations.cancel')}
            </button>
          </>
        ) : (
          <button type="button" onClick={this.onRequestRemove}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400">
            <FrameworkIcons.Trash size={14} />
            {AdminI18n.t('settings.integrations.removeProvider')}
          </button>
        )}
      </div>
    );
  }

  private renderHeading(): ReactNode {
    const integration = this.activeIntegration;
    if (this.single) {
      return (
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{integration.label}</h2>
          {integration.description ? <p className="mt-1 text-[12px] text-slate-500">{integration.description}</p> : null}
        </div>
      );
    }
    const title = this.editor.isNew
      ? AdminI18n.t('settings.integrations.addProvider')
      : this.editor.providerName || this.currentProviderDefinition?.label || this.editor.providerKey;
    return (
      <div className="space-y-2">
        <button type="button" onClick={this.onBack}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
          <FrameworkIcons.ArrowLeft size={13} />
          {AdminI18n.t('settings.integrations.backTo', { label: integration.label })}
        </button>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
    );
  }

  render(): ReactNode {
    const editor = this.editor;
    return (
      <div className="space-y-4">
        {this.renderHeading()}
        <form id={IntegrationProviderEditor.FORM_ID} onSubmit={this.handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {this.single ? this.renderStatus() : null}
            {this.single || editor.isNew ? this.renderProviderChoice() : null}
            {this.single ? null : (
              <Input value={editor.providerName} onChange={this.handleProviderNameChange}
                label={AdminI18n.t('settings.integrations.displayNameOptional')}
                placeholder={this.currentProviderDefinition?.label} autoComplete="off" size={FieldSize.MD} />
            )}
            {this.renderFields()}
          </div>
          <IntegrationSetupAddresses addresses={this.currentProviderDefinition?.setupAddresses || []} />
          {this.renderRemove()}
        </form>
      </div>
    );
  }
}
