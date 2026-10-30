import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import type { ChangeEvent, ReactNode } from 'react';

import { PureReactor, prop, bound, state } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FileDropzone } from '@/components/ui/view/file-dropzone.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import type { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class IntegrationFieldInput extends PureReactor {
  @prop declare field: IIntegrationConfigField;
  @prop declare editor: IProviderEditorState;
  @prop declare fieldOptionsService: IntegrationsFieldOptionsService;
  @prop declare dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  @prop declare dynamicFieldErrors: Record<string, string>;
  @prop declare dynamicFieldLoading: Record<string, boolean>;
  @prop declare onChange: (nextValue: any) => void;
  /** The file the value was read from, shown in the drop zone until Save; never kept or uploaded. */
  @state private chosenFile: File | null = null;
  @state private failedFileName = '';

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

  /**
   * Reads the chosen file into the field — as text, or as base64 when the provider declares a binary file.
   * The file never leaves the browser; only Save sends the value, which is encrypted like any secret.
   */
  @bound
  private handleFileChosen(file: File | null): void {
    this.failedFileName = '';
    this.chosenFile = file;
    if (!file) { this.onChange(''); return; }
    const read = this.field.fileAsBase64
      ? file.arrayBuffer().then((buffer) => IntegrationFieldInput.toBase64(new Uint8Array(buffer)))
      : file.text().then((text) => text.trim());
    read.then((value) => this.onChange(value), () => { this.chosenFile = null; this.failedFileName = file.name; });
  }

  private static toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  /** A field the provider takes as a file: the platform's drop zone in place of a paste box. */
  private renderFile(): ReactNode {
    const { field, editor } = this;
    const accept = field.acceptFile || [];
    // A saved secret stays until a new file replaces it; the drop zone only shows a file chosen now.
    const file = this.hasSavedSecret ? null : this.chosenFile;
    return (
      <div className="md:col-span-2">
        <span className="mb-1.5 block text-[12px] font-semibold text-slate-700 dark:text-slate-300">{`${field.label}${field.required ? ' *' : ''}`}</span>
        <FileDropzone accept={accept.join(',')} file={file} onSelect={this.handleFileChosen}
          hint={AdminI18n.t('settings.integrations.fileTypes', { types: accept.join(', ') })} />
        {this.failedFileName ? <p className="mt-1 text-[11px] text-rose-600">{AdminI18n.t('settings.integrations.fileReadFailed', { name: this.failedFileName })}</p> : null}
        {this.hasSavedSecret && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <FrameworkIcons.CheckCircle size={12} />
            <span>{AdminI18n.t('settings.integrations.fileSavedChooseToReplace')}</span>
          </div>
        )}
        {field.description ? <p className="mt-1 text-[11px] text-slate-500">{field.description}</p> : null}
      </div>
    );
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
      <div className="md:col-span-2">
        <TextArea
          label={`${field.label}${field.required ? ' *' : ''}`}
          placeholder={field.placeholder}
          value={String(this.value ?? '')}
          onChange={this.handleTextAreaChange}
          size={FieldSize.MD}
        />
        {field.description && (
          <p className="mt-1 text-[11px] text-slate-500">{field.description}</p>
        )}
      </div>
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
      ? AdminI18n.t('settings.integrations.loadingOptions')
      : dynamicFieldError
        ? dynamicFieldError
        : !editor.providerId && hasDynamicOptions
          ? AdminI18n.t('settings.integrations.saveThisProviderFirstTo')
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
          placeholder={isDynamicFieldLoading ? AdminI18n.t('settings.integrations.loadingOptions') : undefined}
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
          placeholder={field.type === IntegrationFieldType.PASSWORD && !editor.isNew ? AdminI18n.t('settings.integrations.leaveBlankToKeepThe') : field.placeholder}
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
            <span>{AdminI18n.t('settings.integrations.savedSecurelyLeaveThisField')}</span>
          </div>
        )}
        {/* The saved-secret line above already says to leave it blank; repeating it under it was noise. */}
        {(field.description || (field.type === IntegrationFieldType.PASSWORD && !editor.isNew && !this.hasSavedSecret)) && (
          <p className="mt-1 text-[11px] text-slate-500">
            {field.description || AdminI18n.t('settings.integrations.leaveThisFieldBlankTo')}
          </p>
        )}
      </div>
    );
  }

  render(): ReactNode {
    if (this.field.acceptFile?.length) return this.renderFile();
    if (this.field.type === IntegrationFieldType.BOOLEAN) return this.renderBoolean();
    if (this.field.type === IntegrationFieldType.TEXTAREA) return this.renderTextArea();
    if (this.field.type === IntegrationFieldType.SELECT) return this.renderSelect();
    return this.renderInput();
  }
}
