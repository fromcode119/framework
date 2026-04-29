"use client";

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader } from '@/components/ui/loader';
import { NotificationHooks } from '@/components/use-notification';
import PluginSettingsForm from '@/components/plugins/plugin-settings-form';
import { FrameworkIcons } from '@/lib/icons';
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
  installOperation,
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
  const { notify } = NotificationHooks.useNotify();
  const [isCopyingError, setIsCopyingError] = useState(false);

  const copyPluginError = async (): Promise<void> => {
    if (!plugin.error || isCopyingError) return;
    setIsCopyingError(true);
    try {
      await navigator.clipboard.writeText(plugin.error);
      notify('success', 'Error Copied', 'Plugin startup error copied to clipboard.');
    } catch (error: any) {
      notify('error', 'Copy Failed', error?.message || 'Could not copy the plugin startup error.');
    } finally {
      setIsCopyingError(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {isUpdating && installOperation ? <Loader fullPage label={installOperation.message} /> : null}
      <PluginDetailHeader activeTab={activeTab} isSaving={isSaving} isUpdating={isUpdating} marketplaceItem={marketplaceItem} onSaveSandbox={onSaveSandbox} onUpdate={onUpdate} plugin={plugin} theme={theme} />
      {plugin.error ? (
        <div className={`rounded-[2rem] border px-6 py-5 ${theme === 'dark' ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          <div className="flex items-start gap-4">
            <div className={`rounded-2xl p-3 ${theme === 'dark' ? 'bg-rose-500/10 text-rose-400' : 'bg-white text-rose-500 shadow-sm'}`}>
              <FrameworkIcons.Alert size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Plugin Startup Error</h3>
                <button
                  type="button"
                  onClick={() => void copyPluginError()}
                  disabled={isCopyingError}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all ${theme === 'dark' ? 'border-rose-500/20 bg-slate-950/40 text-rose-200 hover:bg-slate-900/60 disabled:opacity-60' : 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-60'}`}
                >
                  {isCopyingError ? <FrameworkIcons.Loader size={12} className="animate-spin" /> : <FrameworkIcons.Copy size={12} />}
                  <span>Copy Error</span>
                </button>
              </div>
              <p className={`mt-2 text-sm font-medium leading-relaxed ${theme === 'dark' ? 'text-rose-100/90' : 'text-rose-700'}`}>
                This plugin is installed, but its initialization failed during boot. Fix the underlying plugin error and reload or reactivate it.
              </p>
              <pre className={`mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl px-4 py-3 text-xs font-medium leading-relaxed ${theme === 'dark' ? 'bg-slate-950/50 text-rose-100' : 'bg-white text-rose-700 shadow-inner shadow-rose-100/60'}`}>
                {plugin.error}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
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
