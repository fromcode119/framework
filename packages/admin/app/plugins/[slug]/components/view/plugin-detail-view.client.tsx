import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';

import { prop, state, Ref } from '@fromcode119/react-class-components';
import type { ILoadedPlugin, ISettingsTabGroup } from '@fromcode119/core/client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
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
import { PluginProcessCard } from '@/app/plugins/[slug]/components/view/process/plugin-process-card.client';
import { PluginDetailTabs } from '@/app/plugins/[slug]/components/view/plugin-detail-tabs.client';
import { PluginManifestModal } from '@/app/plugins/[slug]/components/view/plugin-manifest-modal.client';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { AdminClass } from '@/lib/admin-class';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PluginDetailView extends AdminComponent {
  @prop declare activeTab: PluginDetailTab;
  @prop declare settingsGroups: ISettingsTabGroup[];
  @prop declare settingsGroup: string;
  @prop declare settingsSection: string;
  @prop declare isDeleting: boolean;
  @prop declare isSaving: boolean;
  @prop declare isUpdating: boolean;
  @prop declare installOperation: IPluginInstallOperation | null;
  @prop declare isolationDefaults: { memoryMb: number; timeoutMs: number } | null;
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
  @prop declare onTabChange: (tabId: PluginDetailTab, group?: string, section?: string) => void;
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
  /** The operator is standing in a site: only what belongs to this site is offered (`PlatformScopeGate` for the rest). */
  @prop declare siteScope: boolean;

  @state isCopyingError = false;

  private async copyPluginError(): Promise<void> {
    const plugin = this.plugin;
    const { notify } = this.runtime.notify;
    if (!plugin.error || this.isCopyingError) return;
    this.isCopyingError = true;
    try {
      await navigator.clipboard.writeText(plugin.error);
      notify(NotificationType.SUCCESS, AdminI18n.t('plugins.detail.errorCopied'), AdminI18n.t('plugins.detail.pluginStartupErrorCopiedTo'));
    } catch (error: any) {
      notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.copyFailed'), error?.message || AdminI18n.t('plugins.detail.couldNotCopyThePlugin'));
    } finally {
      this.isCopyingError = false;
    }
  }

  /** May the platform's own controls for this plugin be used here — by this account, in this scope? */
  private get platformHere(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user) && !this.siteScope;
  }

  render(): ReactNode {
    const { plugin, theme, activeTab, isCopyingError } = this;

    return (
      <div className="w-full space-y-5 pb-12">
        {this.isUpdating && this.installOperation ? <Loader fullPage label={this.installOperation.message} /> : null}
        <PluginDetailHeader activeTab={activeTab} isSaving={this.isSaving} onOpenDefinition={this.onOpenDefinition} onSaveSandbox={this.onSaveSandbox} platformActions={this.platformHere} plugin={plugin} settingsDirty={this.settingsDirty} settingsFormRef={this.settingsFormRef} settingsSaving={this.settingsSaving} theme={theme} />
        {plugin.error ? (
          <div className={`rounded-xl border px-4 py-4 ${theme === ThemeMode.DARK ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-2 ${theme === ThemeMode.DARK ? 'bg-rose-500/10 text-rose-400' : 'bg-white text-rose-500 shadow-sm'}`}>
                <FrameworkIcons.Alert size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">{AdminI18n.t('plugins.detail.pluginStartupError')}</h3>
                  <button
                    type="button"
                    onClick={() => void this.copyPluginError()}
                    disabled={isCopyingError}
                    className={`inline-flex items-center gap-2 ${AdminClass.SURFACE} px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all ${theme === ThemeMode.DARK ? 'border-rose-500/20 bg-slate-950/40 text-rose-200 hover:bg-slate-900/60 disabled:opacity-60' : 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-60'}`}
                  >
                    {isCopyingError ? <FrameworkIcons.Loader size={12} className="animate-spin" /> : <FrameworkIcons.Copy size={12} />}
                    <span>{AdminI18n.t('plugins.detail.copyError')}</span>
                  </button>
                </div>
                <p className={`mt-2 text-sm font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'text-rose-100/90' : 'text-rose-700'}`}>
                  {AdminI18n.t('plugins.detail.thisPluginIsInstalledBut')}
                </p>
                <pre className={`mt-4 overflow-x-auto whitespace-pre-wrap ${AdminClass.SURFACE} px-4 py-3 text-xs font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'bg-slate-950/50 text-rose-100' : 'bg-white text-rose-700 shadow-inner shadow-rose-100/60'}`}>
                  {plugin.error}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
        <section className={`overflow-hidden rounded-2xl border ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
          <PluginDetailTabs activeTab={activeTab} activeGroup={this.settingsGroup} groups={this.settingsGroups} onTabChange={this.onTabChange} siteScope={this.siteScope} theme={theme} />
          {activeTab === PluginDetailTab.SETTINGS ? (
            <PluginSettingsForm ref={this.settingsFormRef} pluginSlug={this.slug} formId="plugin-settings-form" onStateChange={this.onSettingsStateChange}
              group={this.settingsGroup || this.settingsGroups[0]?.id || ''} section={this.settingsSection}
              onSectionChange={(section: string) => this.onTabChange(PluginDetailTab.SETTINGS, this.settingsGroup || this.settingsGroups[0]?.id || '', section)} />
          ) : (
            <div className={activeTab === PluginDetailTab.OVERVIEW ? '' : 'p-6'}>
              {activeTab === PluginDetailTab.OVERVIEW && <PluginDetailOverview isUpdating={this.isUpdating} loadingLogs={this.loadingLogs} logs={this.logs} marketplaceItem={this.marketplaceItem} onOpenDeleteConfirm={this.onOpenDeleteConfirm} onOpenSecurity={() => this.onTabChange(PluginDetailTab.PERMISSIONS)} onRefreshLogs={this.onRefreshLogs} onToggle={this.onToggle} onUpdate={this.onUpdate} platformActions={this.platformHere} plugin={plugin} siteScope={this.siteScope} theme={theme} />}
              {activeTab === PluginDetailTab.PERMISSIONS && (
                <PlatformScopeGate what={AdminI18n.t('plugins.detail.thisPluginSSecurityThe')}>
                  <PluginDetailPermissions plugin={plugin} theme={theme} />
                </PlatformScopeGate>
              )}
              {activeTab === PluginDetailTab.RESOURCES && (
                <PlatformScopeGate what={AdminI18n.t('plugins.detail.thisPluginSResourceLimits')}>
                  <div className="space-y-5">
                    <PluginDetailResources isolationDefaults={this.isolationDefaults} onSandboxSettingsChange={this.onSandboxSettingsChange} sandboxSettings={this.sandboxSettings} theme={theme} />
                    {this.platformHere && <PluginProcessCard slug={this.slug} />}
                  </div>
                </PlatformScopeGate>
              )}
            </div>
          )}
        </section>
        <ConfirmDialog isOpen={this.showDeleteConfirm} onClose={this.onCloseDeleteConfirm} onConfirm={this.onDelete} isLoading={this.isDeleting} title={AdminI18n.t('plugins.detail.confirmUninstallation')} description={AdminI18n.t('plugins.detail.areYouSureYouWant', { name: plugin.manifest.name })} confirmLabel={AdminI18n.t('plugins.detail.uninstallPlugin')} />
        <PluginManifestModal isOpen={this.showDefinition && this.platformHere} onClose={this.onCloseDefinition} plugin={plugin} theme={theme} />
      </div>
    );
  }
}
