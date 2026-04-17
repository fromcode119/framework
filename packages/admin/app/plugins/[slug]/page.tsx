"use client";

import React, { use } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Loader } from '@/components/ui/loader';
import PluginDetailView from './components/plugin-detail-view';
import { PluginDetailPageController } from './plugin-detail-page-controller';

export default function PluginDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const model = PluginDetailPageController.useModel(slug);

  if (model.loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Synchronizing Plugin Manifest..." />
      </div>
    );
  }

  if (!model.plugin) return null;

  return (
    <PluginDetailView
      activeTab={model.activeTab}
      isDeleting={model.isDeleting}
      isSaving={model.isSaving}
      isUpdating={model.isUpdating}
      installOperation={model.installOperation}
      loadingLogs={model.loadingLogs}
      logs={model.logs}
      marketplaceItem={model.marketplaceItem}
      onCloseDefinition={() => model.setShowDefinition(false)}
      onCloseDeleteConfirm={() => model.setShowDeleteConfirm(false)}
      onDelete={model.handleDelete}
      onOpenDefinition={() => model.setShowDefinition(true)}
      onOpenDeleteConfirm={() => model.setShowDeleteConfirm(true)}
      onRefreshLogs={model.fetchLogs}
      onSandboxSettingsChange={model.setSandboxSettings}
      onSaveSandbox={model.handleSaveSandbox}
      onSettingsStateChange={(dirty, saving) => {
        model.setSettingsDirty(dirty);
        model.setSettingsSaving(saving);
      }}
      onTabChange={model.handleTabChange}
      onToggle={model.handleToggle}
      onUpdate={model.handleUpdate}
      plugin={model.plugin}
      sandboxSettings={model.sandboxSettings}
      settingsDirty={model.settingsDirty}
      settingsFormRef={model.settingsFormRef}
      settingsSaving={model.settingsSaving}
      showDefinition={model.showDefinition}
      showDeleteConfirm={model.showDeleteConfirm}
      slug={slug}
      theme={model.theme}
    />
  );
}
