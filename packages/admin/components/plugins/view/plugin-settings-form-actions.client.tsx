import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ChangeEvent, FormEvent } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PluginSettingsFormState } from '@/components/plugins/view/plugin-settings-form-state.client';

/**
 * Loading, saving, resetting, exporting and importing a plugin's settings.
 */
export abstract class PluginSettingsFormActions extends PluginSettingsFormState {
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
}
