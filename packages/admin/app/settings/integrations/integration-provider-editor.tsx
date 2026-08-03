import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationFieldInput } from '@/app/settings/integrations/integration-field-input';
import type { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';

export class IntegrationProviderEditor extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationProviderEditor, 'activeIntegration' | 'editor' | 'currentProviderDefinition' | 'saving' | 'fieldOptionsService' | 'dynamicFieldOptions' | 'dynamicFieldErrors' | 'dynamicFieldLoading' | 'patchEditor' | 'onSubmit' | 'onCancel' | 'onReset'>;

  @prop declare activeIntegration: IIntegrationRecord | null;
  @prop declare editor: IProviderEditorState | null;
  @prop declare currentProviderDefinition: IIntegrationProvider | null;
  @prop declare saving: boolean;
  @prop declare fieldOptionsService: IntegrationsFieldOptionsService;
  @prop declare dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  @prop declare dynamicFieldErrors: Record<string, string>;
  @prop declare dynamicFieldLoading: Record<string, boolean>;
  @prop declare patchEditor: (
    patch: Partial<IProviderEditorState> | ((prev: IProviderEditorState) => IProviderEditorState)
  ) => void;
  @prop declare onSubmit: () => void;
  @prop declare onCancel: () => void;
  @prop declare onReset: () => void;

  private get fields(): IIntegrationConfigField[] {
    return this.currentProviderDefinition?.fields || [];
  }

  private get providerOptions(): Array<{ label: string; value: string }> {
    return (this.activeIntegration?.providers || []).map((provider) => ({
      label: provider.label,
      value: provider.key
    }));
  }

  @bound
  private handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    this.onSubmit();
  }

  @bound
  private handleProviderKeyChange(providerKey: string): void {
    this.patchEditor((previous) => ({
      ...previous,
      providerKey,
      config: {}
    }));
  }

  @bound
  private handleProviderNameChange(event: ChangeEvent<HTMLInputElement>): void {
    const providerName = event.target.value;
    this.patchEditor((previous) => ({
      ...previous,
      providerName
    }));
  }

  @bound
  private handleEnabledChange(value: boolean | undefined): void {
    this.patchEditor((previous) => ({
      ...previous,
      enabled: value ?? false
    }));
  }

  private setFieldValue(field: IIntegrationConfigField, nextValue: any): void {
    this.patchEditor((previous) => ({
      ...previous,
      preservedSecretFields: field.type === IntegrationFieldType.PASSWORD
        ? { ...previous.preservedSecretFields, [field.name]: false }
        : previous.preservedSecretFields,
      config: {
        ...previous.config,
        [field.name]: nextValue
      }
    }));
  }

  private renderFields(editor: IProviderEditorState): ReactNode {
    if (this.fields.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No fields required</p>
          <p className="text-xs text-slate-500 mt-1">
            This provider does not define custom configuration fields.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {this.fields.map((field) => (
          <IntegrationFieldInput
            key={field.name}
            field={field}
            editor={editor}
            fieldOptionsService={this.fieldOptionsService}
            dynamicFieldOptions={this.dynamicFieldOptions}
            dynamicFieldErrors={this.dynamicFieldErrors}
            dynamicFieldLoading={this.dynamicFieldLoading}
            onChange={(nextValue: any) => this.setFieldValue(field, nextValue)}
          />
        ))}
      </div>
    );
  }

  private renderForm(editor: IProviderEditorState): ReactNode {
    return (
      <form className="p-5 space-y-5" onSubmit={this.handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            value={editor.providerKey}
            onChange={this.handleProviderKeyChange}
            options={this.providerOptions}
            label="Provider Type"
            searchable={false}
            size={FieldSize.MD}
          />
          <Input
            value={editor.providerName}
            onChange={this.handleProviderNameChange}
            label="Display Name (Optional)"
            placeholder="e.g. SMTP - Marketing"
            autoComplete="off"
            size={FieldSize.MD}
          />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
          <Switch
            checked={editor.enabled}
            onChange={this.handleEnabledChange}
            label="Enabled"
            description="Enabled providers are available at runtime."
          />
        </div>

        {this.renderFields(editor)}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {editor.isNew ? (
            <Button type="button" variant={ButtonVariant.SECONDARY} onClick={this.onCancel}>
              Cancel
            </Button>
          ) : (
            <Button type="button" variant={ButtonVariant.SECONDARY} onClick={this.onReset}>
              Reset
            </Button>
          )}
          <Button
            type="submit"
            variant={ButtonVariant.PRIMARY}
            icon={<FrameworkIcons.Save size={14} />}
            isLoading={this.saving}
          >
            {editor.isNew ? 'Add Provider' : 'Save Provider'}
          </Button>
        </div>
      </form>
    );
  }

  render(): ReactNode {
    const editor = this.editor;

    return (
      <Card className="xl:col-span-8" noPadding>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            {editor?.isNew ? 'Add Provider' : 'Provider Configuration'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure credentials and behavior for this provider instance.
          </p>
        </div>

        {!editor ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select a provider instance.</p>
            <p className="text-xs text-slate-500 mt-1">
              Or add a new provider to create an additional configuration.
            </p>
          </div>
        ) : (
          this.renderForm(editor)
        )}
      </Card>
    );
  }
}
