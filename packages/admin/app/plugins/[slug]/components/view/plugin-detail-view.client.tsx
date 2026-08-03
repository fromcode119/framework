import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';

import { prop, state, Ref } from '@fromcode119/reactor';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { Loader } from '@/components/ui/view/loader.client';
import { PluginSettingsForm } from '@/components/plugins/view/plugin-settings-form.client';

import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';

import { FrameworkIcons } from '@fromcode119/react';
import { PluginDetailHeader } from '@/app/plugins/[slug]/components/view/plugin-detail-header.client';
import { PluginDetailOverview } from '@/app/plugins/[slug]/components/view/plugin-detail-overview.client';
import { PluginDetailPermissions } from '@/app/plugins/[slug]/components/view/plugin-detail-permissions.client';
import { PluginDetailResources } from '@/app/plugins/[slug]/components/view/plugin-detail-resources.client';
import { PluginDetailSidebar } from '@/app/plugins/[slug]/components/view/plugin-detail-sidebar.client';
import { PluginDetailTabs } from '@/app/plugins/[slug]/components/view/plugin-detail-tabs.client';
import { PluginManifestModal } from '@/app/plugins/[slug]/components/view/plugin-manifest-modal.client';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { AdminClass } from '@/lib/admin-class';

export class PluginDetailView extends AdminComponent {
  @prop declare activeTab: PluginDetailTab;
  @prop declare isDeleting: boolean;
  @prop declare isSaving: boolean;
  @prop declare isUpdating: boolean;
  @prop declare installOperation: IPluginInstallOperation | null;
  @prop declare loadingLogs: boolean;
  @prop declare logs: IPluginLogEntry[];
  @prop declare marketplaceItem: IPluginMarketplaceItem | null;
  @prop declare onDelete: () => void;
  @prop declare onOpenDefinition: () => void;
  @prop declare onOpenDeleteConfirm: () => void;
  @prop declare onRefreshLogs: () => void;
  @prop declare onSaveSandbox: () => void;
  @prop declare onSandboxSettingsChange: (value: IPluginSandboxSettings) => void;
  @prop declare onSettingsStateChange: (dirty: boolean, saving: boolean) => void;
  @prop declare onTabChange: (tabId: PluginDetailTab) => void;
  @prop declare onToggle: () => void;
  @prop declare onUpdate: () => void;
  @prop declare onCloseDeleteConfirm: () => void;
  @prop declare onCloseDefinition: () => void;
  @prop declare plugin: ILoadedPlugin;
  @prop declare sandboxSettings: IPluginSandboxSettings;
  @prop declare settingsDirty: boolean;
  @prop declare settingsFormRef: Ref<PluginSettingsForm>;
  @prop declare settingsSaving: boolean;
  @prop declare showDefinition: boolean;
  @prop declare showDeleteConfirm: boolean;
  @prop declare slug: string;

  @state isCopyingError = false;

  private async copyPluginError(): Promise<void> {
    const plugin = this.plugin;
    const { notify } = this.runtime.notify;
    if (!plugin.error || this.isCopyingError) return;
    this.isCopyingError = true;
    try {
      await navigator.clipboard.writeText(plugin.error);
      notify(NotificationType.SUCCESS, 'Error Copied', 'Plugin startup error copied to clipboard.');
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Copy Failed', error?.message || 'Could not copy the plugin startup error.');
    } finally {
      this.isCopyingError = false;
    }
  }

  render(): ReactNode {
    const { plugin, theme, activeTab, isCopyingError } = this;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {this.isUpdating && this.installOperation ? <Loader fullPage label={this.installOperation.message} /> : null}
        <PluginDetailHeader activeTab={activeTab} isSaving={this.isSaving} isUpdating={this.isUpdating} marketplaceItem={this.marketplaceItem} onSaveSandbox={this.onSaveSandbox} onUpdate={this.onUpdate} plugin={plugin} theme={theme} />
        {plugin.error ? (
          <div className={`rounded-xl border px-4 py-4 ${theme === ThemeMode.DARK ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-2 ${theme === ThemeMode.DARK ? 'bg-rose-500/10 text-rose-400' : 'bg-white text-rose-500 shadow-sm'}`}>
                <FrameworkIcons.Alert size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Plugin Startup Error</h3>
                  <button
                    type="button"
                    onClick={() => void this.copyPluginError()}
                    disabled={isCopyingError}
                    className={`inline-flex items-center gap-2 ${AdminClass.SURFACE} px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all ${theme === ThemeMode.DARK ? 'border-rose-500/20 bg-slate-950/40 text-rose-200 hover:bg-slate-900/60 disabled:opacity-60' : 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-60'}`}
                  >
                    {isCopyingError ? <FrameworkIcons.Loader size={12} className="animate-spin" /> : <FrameworkIcons.Copy size={12} />}
                    <span>Copy Error</span>
                  </button>
                </div>
                <p className={`mt-2 text-sm font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'text-rose-100/90' : 'text-rose-700'}`}>
                  This plugin is installed, but its initialization failed during boot. Fix the underlying plugin error and reload or reactivate it.
                </p>
                <pre className={`mt-4 overflow-x-auto whitespace-pre-wrap ${AdminClass.SURFACE} px-4 py-3 text-xs font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'bg-slate-950/50 text-rose-100' : 'bg-white text-rose-700 shadow-inner shadow-rose-100/60'}`}>
                  {plugin.error}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
        <PluginDetailTabs activeTab={activeTab} onTabChange={this.onTabChange} theme={theme} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
          <div className="lg:col-span-2 space-y-6">
            {activeTab === PluginDetailTab.OVERVIEW && <PluginDetailOverview loadingLogs={this.loadingLogs} logs={this.logs} marketplaceItem={this.marketplaceItem} onRefreshLogs={this.onRefreshLogs} onToggle={this.onToggle} plugin={plugin} theme={theme} />}
            {activeTab === PluginDetailTab.SETTINGS && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PluginSettingsForm ref={this.settingsFormRef} pluginSlug={this.slug} formId="plugin-settings-form" onStateChange={this.onSettingsStateChange} />
              </div>
            )}
            {activeTab === PluginDetailTab.PERMISSIONS && <PluginDetailPermissions plugin={plugin} theme={theme} />}
            {activeTab === PluginDetailTab.RESOURCES && <PluginDetailResources onSandboxSettingsChange={this.onSandboxSettingsChange} sandboxSettings={this.sandboxSettings} theme={theme} />}
          </div>
          <PluginDetailSidebar activeTab={activeTab} onOpenDefinition={this.onOpenDefinition} onOpenDeleteConfirm={this.onOpenDeleteConfirm} onTabChange={this.onTabChange} plugin={plugin} settingsDirty={this.settingsDirty} settingsFormRef={this.settingsFormRef} settingsSaving={this.settingsSaving} theme={theme} />
        </div>
        <ConfirmDialog isOpen={this.showDeleteConfirm} onClose={this.onCloseDeleteConfirm} onConfirm={this.onDelete} isLoading={this.isDeleting} title="Confirm Uninstallation" description={`Are you sure you want to delete ${plugin.manifest.name}? This will remove all associated files and data from the system. This action cannot be undone.`} confirmLabel="Uninstall Plugin" />
        <PluginManifestModal isOpen={this.showDefinition} onClose={this.onCloseDefinition} plugin={plugin} theme={theme} />
      </div>
    );
  }
}
