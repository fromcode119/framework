import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { ref } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import type { IPluginSettingsFormHandle } from '@/components/plugins/interfaces/plugin-settings-form-handle.interface';
import { PluginSettingsFormActions } from '@/components/plugins/view/plugin-settings-form-actions.client';

/**
 * A plugin's settings, rendered from the schema the plugin itself declares.
 *
 * The top of the chain: the lifecycle and the markup. What the form knows and what it can do live in
 * the links below — see `PluginSettingsFormState`.
 */
export class PluginSettingsForm extends PluginSettingsFormActions implements IPluginSettingsFormHandle {
  componentDidMount(): void {
    this.loadSettings();
    this.onStateChange?.(this.isDirty, this.saving);
  }

  componentDidUpdate(prev: { pluginSlug: string }): void {
    if (prev.pluginSlug !== this.pluginSlug) {
      this.loadSettings();
    }
  }

  componentWillUnmount(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  render() {
    const theme = this.theme;
    const schema = this.schema;
    const status = this.status;

    if (this.loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin text-indigo-500">
             <FrameworkIcons.Loader size={32} />
          </div>
        </div>
      );
    }

    if (!schema || !schema.fields || schema.fields.length === 0) {
      return (
        <div className={`p-8 rounded-xl border text-center ${
          theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <FrameworkIcons.Settings size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-500 font-bold">
            This plugin has no configurable settings.
          </p>
        </div>
      );
    }

    const visibleFields = this.visibleFields;

    return (
      <form
        id={this.formId}
        className="space-y-6"
        onSubmit={this.handleSubmit}
      >
        {status && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
            status.type === NotificationType.SUCCESS
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : 'bg-rose-50 border-rose-100 text-rose-700'
          }`}>
            {status.type === NotificationType.SUCCESS ? <FrameworkIcons.Check size={18} /> : <FrameworkIcons.Alert size={18} />}
            <p className="text-sm font-bold">{status.message}</p>
          </div>
        )}

        {/* hidden file input for import */}
        <input ref={this.importInputRef} type="file" accept=".json" onChange={this.handleImport} className="hidden" />

        {/* Tabs */}
        {schema.tabs && schema.tabs.length > 0 && (
          <div className={`flex gap-2 p-2 rounded-xl ${
            theme === ThemeMode.DARK ? 'bg-slate-900' : 'bg-slate-100'
          }`}>
            {schema.tabs.map((tab: any) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => { this.activeTab = tab.id; }}
                className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  this.activeTab === tab.id
                    ? theme === ThemeMode.DARK
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white text-slate-900 shadow-sm'
                    : theme === ThemeMode.DARK
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Fields */}
        <div className={`p-8 rounded-xl border ${
          theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleFields.map((field: any) => {
              const hasSavedSecret = field.type === 'password' && this.savedSecretFields.has(field.name);
              const resolvedField = hasSavedSecret
                ? { ...field, admin: { ...(field.admin || {}), description: 'Saved securely — leave blank to keep the current secret.' } }
                : field;
              return (
                <FieldRenderer
                  key={field.name}
                  field={resolvedField}
                  value={this.settings[field.name]}
                  onChange={(value) => this.handleFieldChange(field.name, value)}
                  theme={theme}
                  collectionSlug={`settings-${this.pluginSlug}`}
                  errors={this.errors[field.name] ? (Array.isArray(this.errors[field.name]) ? (this.errors[field.name] as string[]) : [this.errors[field.name] as string]) : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {this.isDirty && (
              <span className="text-sm font-semibold text-amber-600">Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant={ButtonVariant.GHOST} onClick={this.exportSettings}>
              Export
            </Button>
            <Button type="button" variant={ButtonVariant.GHOST} onClick={this.resetSettings}>
              Reset
            </Button>
            <Button type="submit" disabled={this.saving}>
              {this.saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </div>

      </form>
    );
  }
}
