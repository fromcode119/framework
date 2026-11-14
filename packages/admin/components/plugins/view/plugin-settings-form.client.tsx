import { NotificationType } from '@/components/enums/notification-type.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import type { IPluginSettingsFormHandle } from '@/components/plugins/interfaces/plugin-settings-form-handle.interface';
import { PluginSettingsFormActions } from '@/components/plugins/view/plugin-settings-form-actions.client';
import { PluginSettingsEmpty } from '@/components/plugins/view/plugin-settings-empty.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminClass } from '@/lib/admin-class';
import { Card } from '@/components/ui/view/card.client';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';

/**
 * A plugin's settings, rendered from the schema the plugin itself declares — as the same rows every
 * settings page has (label on the left, the control on the right; `fc-settings-fields` in settings.css)
 * and saved through the same bar at the foot of the page, which shows only while something differs.
 *
 * The top of the chain: the lifecycle and the markup. What the form knows and what it can do live in
 * the links below — see `PluginSettingsFormState`.
 */
export class PluginSettingsForm extends PluginSettingsFormActions implements IPluginSettingsFormHandle {
  componentDidMount(): void {
    this.loadSettings();
    this.onStateChange?.(this.isDirty, this.saving, this.hasFields);
  }

  componentDidUpdate(prev: { pluginSlug: string; waiting?: boolean }): void {
    if (prev.pluginSlug !== this.pluginSlug || Boolean(prev.waiting) !== Boolean(this.waiting)) {
      this.loadSettings();
    }
  }

  componentWillUnmount(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  /**
   * Why the last save was refused. The fields at fault are named, since they may be on another tab or
   * scrolled out of view.
   */
  private get saveRefusal(): string {
    const status = this.status;
    if (!status || status.type !== NotificationType.ERROR) return '';
    const failed = Object.keys(this.errors || {});
    if (!failed.length) return AdminI18n.t('plugins.list.notSaved', { message: status.message });
    const labels = failed.map((name) => (this.schema?.fields || []).find((field: any) => field.name === name)?.label || name);
    return AdminI18n.t('plugins.list.notSavedCorrect', { join: labels.join(', ') });
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
      return <div className="w-full p-6"><Card noPadding><PluginSettingsEmpty waiting={Boolean(this.waiting)} /></Card></div>;
    }

    const visibleFields = this.visibleFields;
    const tabs = this.groupTabs;
    const current = this.currentTabId;
    // The tab bar already names the open tab; a lone tab has no bar, so its name heads the card.
    const heading = tabs.length === 1 ? tabs[0].label : undefined;

    return (
      <form id={this.formId} onSubmit={this.handleSubmit} className="w-full p-6">
        {/* hidden file input for import */}
        <input ref={this.importInputRef} type="file" accept=".json" onChange={this.handleImport} className="hidden" />

        {tabs.length > 1 ? (
          <nav className={AdminClass.of('ext-tabs')}>
            {tabs.map((tab: any) => (
              <button type="button" key={tab.id} onClick={() => this.selectTab(tab.id)} aria-current={tab.id === current ? 'page' : undefined}
                className={AdminClass.of('ext-tabs__tab')}>
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}

        {status && (
          <div role="status" className={`${AdminClass.of('ext-alert')} mb-3 ${status.type === NotificationType.SUCCESS ? AdminClass.of('ext-alert--ok') : AdminClass.of('ext-alert--danger')}`}>
            {status.type === NotificationType.SUCCESS ? <FrameworkIcons.Check size={16} /> : <FrameworkIcons.Alert size={16} />}
            <span>{status.message}</span>
          </div>
        )}
        {this.saveRefusal ? <p role="alert" className={`${AdminClass.of('ext-alert')} ${AdminClass.of('ext-alert--danger')} mb-3`}>{this.saveRefusal}</p> : null}

        <Card noPadding title={heading}>
          <div className={AdminClass.of('settings-fields')}>
              {visibleFields.map((field: any) => {
                const hasSavedSecret = field.type === 'password' && this.savedSecretFields.has(field.name);
                // Keep the plugin's own description (it can carry what to paste elsewhere) and add that a value is
                // held. A read-only secret is written by the plugin, not typed here, so "leave blank to keep" would
                // describe an input it lacks.
                const savedNote = [
                  field.admin?.description,
                  AdminI18n.t(field.admin?.readOnly ? 'plugins.list.savedSecurelyReadOnly' : 'plugins.list.savedSecurelyLeaveBlankTo'),
                ].filter(Boolean).join(' ');
                const resolvedField = hasSavedSecret
                  ? { ...field, admin: { ...(field.admin || {}), description: savedNote } }
                  : field;
                return (
                  <FieldRenderer
                    key={field.name}
                    field={resolvedField}
                    value={this.settings[field.name]}
                    onChange={(value) => this.handleFieldChange(field.name, value)}
                    record={this.settings}
                    onPatch={(partial) => Object.entries(partial).forEach(([name, next]) => this.handleFieldChange(name, next))}
                    theme={theme}
                    collectionSlug={`settings-${this.pluginSlug}`}
                    errors={this.errors[field.name] ? (Array.isArray(this.errors[field.name]) ? (this.errors[field.name] as string[]) : [this.errors[field.name] as string]) : undefined}
                  />
                );
              })}
          </div>
        </Card>

        <SettingsSaveBar dirty={this.isDirty} saving={this.saving} onSave={this.handleSave} onDiscard={this.discardChanges} />
      </form>
    );
  }
}
