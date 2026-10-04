import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import type { IPluginSettingsFormHandle } from '@/components/plugins/interfaces/plugin-settings-form-handle.interface';
import { PluginSettingsFormActions } from '@/components/plugins/view/plugin-settings-form-actions.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
      return (
        <div className={`p-8 rounded-xl border text-center ${
          theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <FrameworkIcons.Settings size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-500 font-bold">
            {AdminI18n.t('plugins.list.thisPluginHasNoConfigurable')}
          </p>
        </div>
      );
    }

    const visibleFields = this.visibleFields;
    const tabs = this.groupTabs;
    const current = this.currentTabId;
    const dark = theme === ThemeMode.DARK;
    const currentTab = tabs.find((tab: any) => tab.id === current);

    return (
      <form id={this.formId} onSubmit={this.handleSubmit}>
        {/* hidden file input for import */}
        <input ref={this.importInputRef} type="file" accept=".json" onChange={this.handleImport} className="hidden" />

        {/* The group's own tabs: a second, quieter row beneath the page's tabs. */}
        {tabs.length > 1 ? (
          <div className={`flex gap-6 overflow-x-auto [scrollbar-width:none] border-b px-6 text-[12.5px] ${dark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
            {tabs.map((tab: any) => (
              <button type="button" key={tab.id} onClick={() => this.selectTab(tab.id)} aria-current={tab.id === current ? 'page' : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 py-2.5 transition-colors ${tab.id === current
                  ? (dark ? 'border-indigo-300 text-white' : 'border-indigo-500 text-slate-900')
                  : (dark ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800')}`}>
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-4 p-6">
          {currentTab ? <h2 className={`text-base font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{currentTab.label}</h2> : null}
          {status && (
            <div className={`flex items-center gap-3 rounded-xl border p-3 ${status.type === NotificationType.SUCCESS ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {status.type === NotificationType.SUCCESS ? <FrameworkIcons.Check size={16} /> : <FrameworkIcons.Alert size={16} />}
              <p className="text-sm font-semibold">{status.message}</p>
            </div>
          )}
          {this.saveRefusal ? <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{this.saveRefusal}</p> : null}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {visibleFields.map((field: any) => {
              const hasSavedSecret = field.type === 'password' && this.savedSecretFields.has(field.name);
              const resolvedField = hasSavedSecret
                ? { ...field, admin: { ...(field.admin || {}), description: AdminI18n.t('plugins.list.savedSecurelyLeaveBlankTo') } }
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
      </form>
    );
  }
}
