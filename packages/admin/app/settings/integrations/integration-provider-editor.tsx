import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationFieldInput } from './integration-field-input';
import type { IntegrationProviderEditorProps } from './integration-provider-editor.interfaces';

export class IntegrationProviderEditor extends React.Component<IntegrationProviderEditorProps> {
  render(): React.ReactNode {
    const {
      activeIntegration,
      editor,
      currentProviderDefinition,
      saving,
      fieldOptionsService,
      dynamicFieldOptions,
      dynamicFieldErrors,
      dynamicFieldLoading,
      patchEditor,
      onSubmit,
      onCancel,
      onReset,
    } = this.props;
    const fields = currentProviderDefinition?.fields || [];

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
          <form
            className="p-5 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                value={editor.providerKey}
                onChange={(providerKey) =>
                  patchEditor((previous) => ({
                    ...previous,
                    providerKey,
                    config: {}
                  }))
                }
                options={(activeIntegration?.providers || []).map((provider) => ({
                  label: provider.label,
                  value: provider.key
                }))}
                label="Provider Type"
                searchable={false}
                size="md"
              />
              <Input
                value={editor.providerName}
                onChange={(event) =>
                  patchEditor((previous) => ({
                    ...previous,
                    providerName: event.target.value
                  }))
                }
                label="Display Name (Optional)"
                placeholder="e.g. SMTP - Marketing"
                autoComplete="off"
                size="md"
              />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
              <Switch
                checked={editor.enabled}
                onChange={(value) =>
                  patchEditor((previous) => ({
                    ...previous,
                    enabled: value ?? false
                  }))
                }
                label="Enabled"
                description="Enabled providers are available at runtime."
              />
            </div>

            {fields.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field) => {
                  const setFieldValue = (nextValue: any) =>
                    patchEditor((previous) => ({
                      ...previous,
                      preservedSecretFields: field.type === 'password'
                        ? { ...previous.preservedSecretFields, [field.name]: false }
                        : previous.preservedSecretFields,
                      config: {
                        ...previous.config,
                        [field.name]: nextValue
                      }
                    }));

                  return (
                    <IntegrationFieldInput
                      key={field.name}
                      field={field}
                      editor={editor}
                      fieldOptionsService={fieldOptionsService}
                      dynamicFieldOptions={dynamicFieldOptions}
                      dynamicFieldErrors={dynamicFieldErrors}
                      dynamicFieldLoading={dynamicFieldLoading}
                      onChange={setFieldValue}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No fields required</p>
                <p className="text-xs text-slate-500 mt-1">
                  This provider does not define custom configuration fields.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {editor.isNew ? (
                <Button type="button" variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={onReset}>
                  Reset
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                icon={<FrameworkIcons.Save size={14} />}
                isLoading={saving}
              >
                {editor.isNew ? 'Add Provider' : 'Save Provider'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    );
  }
}
