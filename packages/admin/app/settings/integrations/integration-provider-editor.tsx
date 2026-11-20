import { Hint } from '@/components/ui/view/hint.client';
import { Label } from '@/components/ui/view/label.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Text } from '@/components/ui/view/text.client';
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
import { EmailDeliveryRoute } from '@fromcode119/core/client';

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
    return this.routeText() || AdminI18n.t('settings.integrations.statusInUse', { provider: label, source: sourceText });
  }

  /**
   * Inside a site, where its mail actually goes when that is not its own provider. Without it the line
   * read "Mock Driver is in use — set in the server environment" while every message the site sent was
   * refused, and nothing on the page said so; only the api's log did.
   */
  private routeText(): string {
    const route = EmailDeliveryRoute.fromValue(String(this.activeIntegration.active?.route ?? ''));
    if (route === EmailDeliveryRoute.NONE) return AdminI18n.t('settings.integrations.routeNone');
    if (route === EmailDeliveryRoute.PLATFORM_UNAVAILABLE) return AdminI18n.t('settings.integrations.routePlatformUnavailable');
    if (route === EmailDeliveryRoute.PLATFORM) return AdminI18n.t('settings.integrations.routePlatform');
    return '';
  }

  private renderStatus(): ReactNode {
    return (
      <div className="fc-form-grid__wide fc-field-stack">
        <Label optional={AdminI18n.t('ui.field.readOnly')}>{AdminI18n.t('settings.integrations.status')}</Label>
        <span className="fc-field-shown">{this.statusText()}</span>
      </div>
    );
  }

  private renderProviderChoice(): ReactNode {
    return (
      <div className="fc-field-stack">
        <Select value={this.editor.providerKey} onChange={this.onChooseProvider} options={this.providerOptions}
          label={AdminI18n.t('settings.integrations.provider')} searchable={false} size={FieldSize.MD} />
        {this.single ? <Hint>{AdminI18n.t('settings.integrations.oneProviderAtATime')}</Hint> : null}
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
      return <div className="fc-form-foot"><Hint>{AdminI18n.t('settings.integrations.removeLastRefused')}</Hint></div>;
    }
    return (
      <div className="fc-form-foot">
        {this.confirmingRemove ? (
          <>
            <Button variant={ButtonVariant.DANGER} isLoading={this.removing} icon={<FrameworkIcons.Trash size={14} />} onClick={this.onConfirmRemove}>{AdminI18n.t('settings.integrations.removeProvider')}</Button>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.onCancelRemove}>{AdminI18n.t('settings.integrations.cancel')}</Button>
          </>
        ) : (
          <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Trash size={14} />} onClick={this.onRequestRemove}>{AdminI18n.t('settings.integrations.removeProvider')}</Button>
        )}
      </div>
    );
  }

  /** The card's name, and for one provider among several the way back to the list. */
  private get title(): string {
    if (this.single) return this.activeIntegration.label;
    return this.editor.isNew
      ? AdminI18n.t('settings.integrations.addProvider')
      : this.editor.providerName || this.currentProviderDefinition?.label || this.editor.providerKey;
  }

  render(): ReactNode {
    const editor = this.editor;
    const integration = this.activeIntegration;
    return (
      <RecordCard title={this.title}
        aside={this.single ? undefined : <div className="fc-record-card__table-tools"><Button variant={ButtonVariant.GHOST} icon={<FrameworkIcons.ArrowLeft size={14} />} onClick={this.onBack}>{AdminI18n.t('settings.integrations.backTo', { label: integration.label })}</Button></div>}>
        <form id={IntegrationProviderEditor.FORM_ID} onSubmit={this.handleSubmit} className="fc-form-stack">
          {this.single && integration.description ? <Text size="small" muted as="p">{integration.description}</Text> : null}
          <div className="fc-form-grid">
            {this.single ? this.renderStatus() : null}
            {this.single || editor.isNew ? this.renderProviderChoice() : null}
            {this.single ? null : (
              <Input value={editor.providerName} onChange={this.handleProviderNameChange}
                label={AdminI18n.t('settings.integrations.displayNameOptional')}
                placeholder={this.currentProviderDefinition?.label} autoComplete="off" />
            )}
            {this.renderFields()}
          </div>
          <IntegrationSetupAddresses addresses={this.currentProviderDefinition?.setupAddresses || []} />
          {this.renderRemove()}
        </form>
      </RecordCard>
    );
  }
}
