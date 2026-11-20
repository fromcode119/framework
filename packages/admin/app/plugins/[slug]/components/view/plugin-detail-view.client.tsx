import { PluginState } from '@fromcode119/core/client';
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
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { AdminClass } from '@/lib/admin-class';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { Alert } from '@/components/ui/view/alert.client';

export class PluginDetailView extends AdminComponent {
  @prop declare activeTab: PluginDetailTab;
  @prop declare settingsGroups: ISettingsTabGroup[];
  @prop declare settingsGroup: string;
  @prop declare settingsSection: string;
  @prop declare isDeleting: boolean;
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
  @prop declare onSaveSandbox: () => Promise<boolean>;
  @prop declare onSandboxSettingsChange: (value: IPluginSandboxSettings) => void;
  @prop declare onSettingsStateChange: (dirty: boolean, saving: boolean, hasFields: boolean) => void;
  @prop declare onTabChange: (tabId: PluginDetailTab, group?: string, section?: string) => void;
  @prop declare onToggle: () => void;
  @prop declare onUpdate: () => void;
  @prop declare onCloseDeleteConfirm: () => void;
  @prop declare onCloseDefinition: () => void;
  @prop declare plugin: ILoadedPlugin;
  @prop declare sandboxSettings: IPluginSandboxSettings;
  @prop declare settingsFormRef: Ref<PluginSettingsForm>;
  @prop declare settingsHasFields: boolean;
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
    const bare = activeTab === PluginDetailTab.OVERVIEW || activeTab === PluginDetailTab.RESOURCES;

    return (
      <div className="w-full pb-12">
        {this.isUpdating && this.installOperation ? <Loader fullPage label={this.installOperation.message} /> : null}
        <PluginDetailHeader activeTab={activeTab} onOpenDefinition={this.onOpenDefinition} platformActions={this.platformHere} plugin={plugin} settingsFormRef={this.settingsFormRef} settingsHasFields={this.settingsHasFields} />
        <PluginDetailTabs activeTab={activeTab} activeGroup={this.settingsGroup} groups={this.settingsGroups} onTabChange={this.onTabChange} platformPart={plugin.manifest.platform === true} siteScope={this.siteScope} theme={theme} />
        {plugin.error ? (
          // The plugin's own words under the alert, as written: the operator copies them to whoever fixes it.
          <div className="fc-plugin-error">
            <Alert
              tone="danger"
              title={AdminI18n.t('plugins.detail.pluginStartupError')}
              action={(
                <Button size={FieldSize.SM} variant={ButtonVariant.SECONDARY} isLoading={isCopyingError} icon={<FrameworkIcons.Copy size={14} />} onClick={() => void this.copyPluginError()}>
                  {AdminI18n.t('plugins.detail.copyError')}
                </Button>
              )}
            >
              {AdminI18n.t('plugins.detail.thisPluginIsInstalledBut')}
            </Alert>
            <pre className="fc-plugin-error__trace">{plugin.error}</pre>
          </div>
        ) : null}
          {activeTab === PluginDetailTab.SETTINGS ? (
            <PluginSettingsForm ref={this.settingsFormRef} pluginSlug={this.slug} formId="plugin-settings-form" waiting={PluginState.resolve(plugin.state) !== PluginState.ACTIVE} onStateChange={this.onSettingsStateChange}
              group={this.settingsGroup || this.settingsGroups[0]?.id || ''} section={this.settingsSection}
              onSectionChange={(section: string) => this.onTabChange(PluginDetailTab.SETTINGS, this.settingsGroup || this.settingsGroups[0]?.id || '', section)} />
          ) : activeTab === PluginDetailTab.PLATFORM_SETTINGS ? (
            <PlatformScopeGate what={AdminI18n.t('plugins.detail.thisPluginSPlatformSettings')}>
              <PluginSettingsForm key="platform-settings" ref={this.settingsFormRef} pluginSlug={this.slug} formId="plugin-settings-form" platform
                waiting={PluginState.resolve(plugin.state) !== PluginState.ACTIVE} onStateChange={this.onSettingsStateChange} />
            </PlatformScopeGate>
          ) : (
            // Overview and Resources are made of cards of their own; only Security is one panel on a surface.
            <div className="w-full py-6"><section className={bare ? '' : `overflow-hidden ${AdminClass.SURFACE}`}><div className={bare ? '' : 'p-6'}>
              {activeTab === PluginDetailTab.OVERVIEW && <PluginDetailOverview isUpdating={this.isUpdating} loadingLogs={this.loadingLogs} logs={this.logs} marketplaceItem={this.marketplaceItem} onOpenDeleteConfirm={this.onOpenDeleteConfirm} onOpenSecurity={() => this.onTabChange(PluginDetailTab.PERMISSIONS)} onRefreshLogs={this.onRefreshLogs} onToggle={this.onToggle} onUpdate={this.onUpdate} platformActions={this.platformHere} plugin={plugin} siteScope={this.siteScope} theme={theme} />}
              {activeTab === PluginDetailTab.PERMISSIONS && (
                <PlatformScopeGate what={AdminI18n.t('plugins.detail.thisPluginSSecurityThe')}>
                  <PluginDetailPermissions plugin={plugin} theme={theme} />
                </PlatformScopeGate>
              )}
              {activeTab === PluginDetailTab.RESOURCES && (
                <PlatformScopeGate what={AdminI18n.t('plugins.detail.thisPluginSResourceLimits')}>
                  <div className="space-y-5">
                    <PluginDetailResources isolationDefaults={this.isolationDefaults} onSandboxSettingsChange={this.onSandboxSettingsChange} onSave={this.onSaveSandbox} sandboxSettings={this.sandboxSettings} theme={theme} />
                    {this.platformHere && <PluginProcessCard slug={this.slug} />}
                    <PendingSavesBar />
                  </div>
                </PlatformScopeGate>
              )}
            </div></section></div>
          )}
        <ConfirmDialog isOpen={this.showDeleteConfirm} onClose={this.onCloseDeleteConfirm} onConfirm={this.onDelete} isLoading={this.isDeleting} title={AdminI18n.t('plugins.detail.confirmUninstallation')} description={AdminI18n.t('plugins.detail.areYouSureYouWant', { name: plugin.manifest.name })} confirmLabel={AdminI18n.t('plugins.detail.uninstallPlugin')} />
        <PluginManifestModal isOpen={this.showDefinition && this.platformHere} onClose={this.onCloseDefinition} plugin={plugin} />
      </div>
    );
  }
}
