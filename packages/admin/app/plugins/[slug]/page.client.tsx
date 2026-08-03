import { use } from 'react';
import type { ReactNode } from 'react';
import { Bridge, prop } from '@fromcode119/reactor';
import { Loader } from '@/components/ui/view/loader.client';
import { PluginDetailView } from '@/app/plugins/[slug]/components/view/plugin-detail-view.client';
import { PluginDetailPageController } from '@/app/plugins/[slug]/plugin-detail-page-controller';
import type { IPluginDetailPageValues } from '@/app/plugins/[slug]/interfaces/plugin-detail-page-values.interface';

/** Hook→class bridge: reads the route param + page model, then renders the hook-free detail view. */
export class PluginDetailPage extends Bridge<IPluginDetailPageValues> {
  @prop declare params: Promise<{ slug: string }>;

  protected read(): IPluginDetailPageValues {
    const slug = use(this.params).slug;
    return { slug, model: PluginDetailPageController.useModel(slug) };
  }

  protected present({ slug, model }: IPluginDetailPageValues): ReactNode {
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
        onSettingsStateChange={(dirty: boolean, saving: boolean) => {
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
      />
    );
  }
}
