import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import type { ChangeEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import type { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';

export class IntegrationFieldInput extends PureReactor {
  @prop declare field: IIntegrationConfigField;
  @prop declare editor: IProviderEditorState;
  @prop declare fieldOptionsService: IntegrationsFieldOptionsService;
  @prop declare dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  @prop declare dynamicFieldErrors: Record<string, string>;
  @prop declare dynamicFieldLoading: Record<string, boolean>;
  @prop declare onChange: (nextValue: any) => void;

  private get value(): any {
    return this.editor.config?.[this.field.name];
  }

  private get hasSavedSecret(): boolean {
    return this.field.type === IntegrationFieldType.PASSWORD && this.editor.preservedSecretFields?.[this.field.name] === true;
  }

  @bound
  private handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    this.onChange(event.target.value);
  }

  @bound
  private handleTextAreaChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    this.onChange(event.target.value);
  }

  private renderBoolean(): ReactNode {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 md:col-span-2">
        <Switch
          checked={!!this.value}
          onChange={this.onChange}
          label={this.field.label}
          description={this.field.description}
        />
      </div>
    );
  }

  private renderTextArea(): ReactNode {
    const field = this.field;
    return (
      <TextArea
        label={`${field.label}${field.required ? ' *' : ''}`}
        placeholder={field.placeholder}
        value={String(this.value ?? '')}
        onChange={this.handleTextAreaChange}
        className="md:col-span-2"
        size={FieldSize.MD}
      />
    );
  }

  private renderSelect(): ReactNode {
    const { field, editor, fieldOptionsService, dynamicFieldOptions, dynamicFieldErrors, dynamicFieldLoading } = this;
    const value = this.value;
    const fieldStateKey = fieldOptionsService.buildFieldStateKey(
      editor.isNew ? '' : editor.providerId,
      editor.providerKey,
      field.name
    );
    const hasDynamicOptions = !!field.optionsEndpoint;
    const options = fieldOptionsService.ensureValueOption(
      dynamicFieldOptions[fieldStateKey] || (field.options || []).map((option) => ({
        label: option.label,
        value: option.value
      })),
      value
    );
    const isDynamicFieldLoading = !!dynamicFieldLoading[fieldStateKey];
    const dynamicFieldError = dynamicFieldErrors[fieldStateKey];
    const helperText = isDynamicFieldLoading
      ? 'Loading options...'
      : dynamicFieldError
        ? dynamicFieldError
        : !editor.providerId && hasDynamicOptions
          ? 'Save this provider first to load the office list.'
          : field.description;
    return (
      <div>
        <Select
          value={String(value ?? '')}
          onChange={this.onChange}
          options={options}
          label={`${field.label}${field.required ? ' *' : ''}`}
          searchable={field.searchable !== false}
          size={FieldSize.MD}
          disabled={isDynamicFieldLoading || (!editor.providerId && hasDynamicOptions)}
          placeholder={isDynamicFieldLoading ? 'Loading options...' : undefined}
        />
        {helperText && (
          <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }

  private renderInput(): ReactNode {
    const { field, editor } = this;
    return (
      <div>
        <Input
          label={`${field.label}${field.required ? ' *' : ''}`}
          placeholder={field.type === IntegrationFieldType.PASSWORD && !editor.isNew ? 'Leave blank to keep the saved secret' : field.placeholder}
          value={String(this.value ?? '')}
          onChange={this.handleInputChange}
          type={field.type === IntegrationFieldType.PASSWORD ? 'password' : field.type === IntegrationFieldType.NUMBER ? 'number' : 'text'}
          autoComplete={IntegrationsPageUtils.resolveFieldAutocomplete(field)}
          step={field.type === IntegrationFieldType.NUMBER ? 'any' : undefined}
          size={FieldSize.MD}
        />
        {field.type === IntegrationFieldType.PASSWORD && this.hasSavedSecret && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <FrameworkIcons.CheckCircle size={12} />
            <span>Saved securely. Leave this field blank to keep the current secret.</span>
          </div>
        )}
        {(field.description || (field.type === IntegrationFieldType.PASSWORD && !editor.isNew)) && (
          <p className="mt-1 text-[11px] text-slate-500">
            {field.description || 'Leave this field blank to keep the saved secret.'}
          </p>
        )}
      </div>
    );
  }

  render(): ReactNode {
    if (this.field.type === IntegrationFieldType.BOOLEAN) return this.renderBoolean();
    if (this.field.type === IntegrationFieldType.TEXTAREA) return this.renderTextArea();
    if (this.field.type === IntegrationFieldType.SELECT) return this.renderSelect();
    return this.renderInput();
  }
}
