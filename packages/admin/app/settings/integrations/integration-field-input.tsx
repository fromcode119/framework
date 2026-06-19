import React from 'react';
import { Input } from '@/components/ui/input';
import { TextArea } from '@/components/ui/text-area';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationsPageUtils } from './IntegrationsPageUtils';
import type { IntegrationFieldInputProps } from './integration-field-input.interfaces';

export class IntegrationFieldInput extends React.Component<IntegrationFieldInputProps> {
  render(): React.ReactNode {
    const {
      field,
      editor,
      fieldOptionsService,
      dynamicFieldOptions,
      dynamicFieldErrors,
      dynamicFieldLoading,
      onChange,
    } = this.props;
    const value = editor.config?.[field.name];
    const hasSavedSecret = field.type === 'password' && editor.preservedSecretFields?.[field.name] === true;

    if (field.type === 'boolean') {
      return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 md:col-span-2">
          <Switch
            checked={!!value}
            onChange={onChange}
            label={field.label}
            description={field.description}
          />
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <TextArea
          label={`${field.label}${field.required ? ' *' : ''}`}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className="md:col-span-2"
          size="md"
        />
      );
    }

    if (field.type === 'select') {
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
            onChange={onChange}
            options={options}
            label={`${field.label}${field.required ? ' *' : ''}`}
            searchable={field.searchable !== false}
            size="md"
            disabled={isDynamicFieldLoading || (!editor.providerId && hasDynamicOptions)}
            placeholder={isDynamicFieldLoading ? 'Loading options...' : undefined}
          />
          {helperText && (
            <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
          )}
        </div>
      );
    }

    return (
      <div>
        <Input
          label={`${field.label}${field.required ? ' *' : ''}`}
          placeholder={field.type === 'password' && !editor.isNew ? 'Leave blank to keep the saved secret' : field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          autoComplete={IntegrationsPageUtils.resolveFieldAutocomplete(field)}
          step={field.type === 'number' ? 'any' : undefined}
          size="md"
        />
        {field.type === 'password' && hasSavedSecret && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <FrameworkIcons.CheckCircle size={12} />
            <span>Saved securely. Leave this field blank to keep the current secret.</span>
          </div>
        )}
        {(field.description || (field.type === 'password' && !editor.isNew)) && (
          <p className="mt-1 text-[11px] text-slate-500">
            {field.description || 'Leave this field blank to keep the saved secret.'}
          </p>
        )}
      </div>
    );
  }
}
