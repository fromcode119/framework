"use client";

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import PluginSettingsForm from '@/components/plugins/plugin-settings-form';
import PluginDetailHeader from './plugin-detail-header';
import PluginDetailOverview from './plugin-detail-overview';
import PluginDetailPermissions from './plugin-detail-permissions';
import PluginDetailResources from './plugin-detail-resources';
import PluginDetailSidebar from './plugin-detail-sidebar';
import PluginDetailTabs from './plugin-detail-tabs';
import PluginManifestModal from './plugin-manifest-modal';
import type { PluginDetailViewProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailView({
  activeTab,
  isDeleting,
  isSaving,
  isUpdating,
  loadingLogs,
  logs,
  marketplaceItem,
  onCloseDefinition,
  onCloseDeleteConfirm,
  onDelete,
  onOpenDefinition,
  onOpenDeleteConfirm,
  onRefreshLogs,
  onSandboxSettingsChange,
  onSaveSandbox,
  onSettingsStateChange,
  onTabChange,
  onToggle,
  onUpdate,
  plugin,
  sandboxSettings,
  settingsDirty,
  settingsFormRef,
  settingsSaving,
  showDefinition,
  showDeleteConfirm,
  slug,
  theme,
}: PluginDetailViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <PluginDetailHeader activeTab={activeTab} isSaving={isSaving} isUpdating={isUpdating} marketplaceItem={marketplaceItem} onSaveSandbox={onSaveSandbox} onUpdate={onUpdate} plugin={plugin} theme={theme} />
      <PluginDetailTabs activeTab={activeTab} onTabChange={onTabChange} theme={theme} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'overview' && <PluginDetailOverview loadingLogs={loadingLogs} logs={logs} marketplaceItem={marketplaceItem} onRefreshLogs={onRefreshLogs} onToggle={onToggle} plugin={plugin} theme={theme} />}
          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PluginSettingsForm ref={settingsFormRef} pluginSlug={slug} formId="plugin-settings-form" onStateChange={onSettingsStateChange} />
            </div>
          )}
          {activeTab === 'permissions' && <PluginDetailPermissions plugin={plugin} theme={theme} />}
          {activeTab === 'resources' && <PluginDetailResources onSandboxSettingsChange={onSandboxSettingsChange} sandboxSettings={sandboxSettings} theme={theme} />}
        </div>
        <PluginDetailSidebar activeTab={activeTab} onOpenDefinition={onOpenDefinition} onOpenDeleteConfirm={onOpenDeleteConfirm} onTabChange={onTabChange} plugin={plugin} settingsDirty={settingsDirty} settingsFormRef={settingsFormRef} settingsSaving={settingsSaving} theme={theme} />
      </div>
      <ConfirmDialog isOpen={showDeleteConfirm} onClose={onCloseDeleteConfirm} onConfirm={onDelete} isLoading={isDeleting} title="Confirm Uninstallation" description={`Are you sure you want to delete ${plugin.manifest.name}? This will remove all associated files and data from the system. This action cannot be undone.`} confirmLabel="Uninstall Plugin" />
      <PluginManifestModal isOpen={showDefinition} onClose={onCloseDefinition} plugin={plugin} theme={theme} />
    </div>
  );
}
