import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ChangeEvent, FormEvent } from 'react';
import { prop, state, bound, ref, watch } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IPluginSettingsFormHandle } from '@/components/plugins/interfaces/plugin-settings-form-handle.interface';

/**
 * Hook-free class body of the plugin settings form. A class component instance IS its own ref
 * handle, so the former `forwardRef` + `useImperativeHandle` are replaced by public
 * `exportSettings`/`importSettings`/`resetSettings` methods (see {@link PluginSettingsFormHandle}).
 * Theme and the plugin registry (`triggerRefresh`) come from {@link AdminComponent}'s runtime
 * context instead of `ThemeHooks.useTheme()` / `ContextHooks.usePlugins()`.
 */
export class PluginSettingsForm extends AdminComponent implements IPluginSettingsFormHandle {
  @prop declare pluginSlug: string;
  @prop declare formId?: string;
  @prop declare onStateChange?: (isDirty: boolean, saving: boolean) => void;

  @ref declare private importInputRef: Ref<HTMLInputElement>;

  @state loading = true;
  @state saving = false;
  @state schema: any = null;
  @state settings: Record<string, any> = {};
  @state savedSecretFields: Set<string> = new Set();
  @state errors: Record<string, string | string[]> = {};
  @state activeTab = '';
  @state isDirty = false;
  @state status: { type: NotificationType; message: string } | null = null;

  private statusTimer?: ReturnType<typeof setTimeout>;

  private get triggerRefresh(): () => void {
    return this.runtime.plugins.triggerRefresh;
  }

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

  @watch('status')
  onStatusChange(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (this.status) {
      this.statusTimer = setTimeout(() => {
        this.status = null;
      }, 5000);
    }
  }

  @watch('isDirty', 'saving')
  notifyStateChange(): void {
    this.onStateChange?.(this.isDirty, this.saving);
  }

  async loadSettings(): Promise<void> {
    this.loading = true;
    this.status = null;
    try {
      const [schemaRes, settingsRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_SCHEMA(this.pluginSlug)),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS(this.pluginSlug)),
      ]);

      const nextSchema = schemaRes;
      const rawSettings: Record<string, any> = settingsRes.settings || {};
      const passwordFields = new Set<string>(
        (nextSchema.fields || []).filter((f: any) => f.type === 'password').map((f: any) => f.name)
      );
      const nextSavedSecrets = new Set<string>();
      const nextSettings: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawSettings)) {
        if (passwordFields.has(key) && String(value || '').trim()) {
          nextSavedSecrets.add(key);
          nextSettings[key] = '';
        } else {
          nextSettings[key] = value;
        }
      }

      this.schema = nextSchema;
      this.settings = nextSettings;
      this.savedSecretFields = nextSavedSecrets;

      if (nextSchema.tabs && nextSchema.tabs.length > 0) {
        this.activeTab = nextSchema.tabs[0].id;
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      // If schema fails with 404, it might mean no settings registered
      if (err.status === 404) {
        this.schema = { fields: [] };
      } else {
        this.status = { type: NotificationType.ERROR, message: 'Failed to load plugin settings.' };
      }
    } finally {
      this.loading = false;
    }
  }

  @bound
  async handleSave(): Promise<void> {
    this.saving = true;
    this.errors = {};
    this.status = null;

    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS(this.pluginSlug), this.settings);
      this.isDirty = false;
      this.status = { type: NotificationType.SUCCESS, message: 'Settings saved successfully!' };
      this.triggerRefresh();
    } catch (err: any) {
      console.error('Save error:', err);
      if (err.data?.errors) {
        this.errors = err.data.errors;
        this.status = { type: NotificationType.ERROR, message: 'Validation failed. Please check the fields below.' };
      } else {
        this.status = { type: NotificationType.ERROR, message: err.message || 'Failed to save settings.' };
      }
    } finally {
      this.saving = false;
    }
  }

  @bound
  async resetSettings(): Promise<void> {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      const res = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_RESET(this.pluginSlug));
      const nextSettings = res.settings || {};
      this.settings = nextSettings;
      this.isDirty = false;
      this.status = { type: NotificationType.SUCCESS, message: 'Settings reset to defaults.' };
      this.triggerRefresh();
    } catch (err: any) {
      this.status = { type: NotificationType.ERROR, message: 'Failed to reset: ' + err.message };
    }
  }

  @bound
  exportSettings(): void {
    window.open(AdminApi.getURL(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_EXPORT(this.pluginSlug)), '_blank');
  }

  @bound
  importSettings(): void {
    this.importInputRef.current?.click();
  }

  @bound
  async handleImport(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedSettings = JSON.parse(content);

        await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_IMPORT(this.pluginSlug), importedSettings);
        await this.loadSettings();
        this.isDirty = false;
        this.triggerRefresh();
        this.status = { type: NotificationType.SUCCESS, message: 'Settings imported successfully.' };
      } catch (error: any) {
        this.status = { type: NotificationType.ERROR, message: 'Import failed: ' + error.message };
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  handleFieldChange(fieldName: string, value: any): void {
    this.settings = {
      ...this.settings,
      [fieldName]: value,
    };
    this.isDirty = true;

    if (this.savedSecretFields.has(fieldName) && value !== '') {
      const next = new Set(this.savedSecretFields);
      next.delete(fieldName);
      this.savedSecretFields = next;
    }

    // Clear error for this field
    if (this.errors[fieldName]) {
      const newErrors = { ...this.errors };
      delete newErrors[fieldName];
      this.errors = newErrors;
    }
  }

  @bound
  handleSubmit(event: FormEvent): void {
    event.preventDefault();
    this.handleSave();
  }

  private get visibleFields(): any[] {
    const schema = this.schema;
    if (!schema.tabs || schema.tabs.length === 0) {
      return schema.fields;
    }

    const currentTab = schema.tabs.find((t: any) => t.id === this.activeTab);
    if (!currentTab) return schema.fields;

    return schema.fields.filter((f: any) => {
      // Check if field specifically belongs to this tab
      if (f.tab === this.activeTab) return true;

      // Check if tab definition explicitly lists this field
      if (currentTab.fields && Array.isArray(currentTab.fields)) {
        return currentTab.fields.includes(f.name);
      }

      return false;
    });
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
