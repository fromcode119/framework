import { use } from 'react';
import type { ReactNode } from 'react';
import { Bridge, prop } from '@fromcode119/react-class-components';
import { Loader } from '@/components/ui/view/loader.client';
import { PluginDetailView } from '@/app/plugins/[slug]/components/view/plugin-detail-view.client';
import { PluginDetailPageController } from '@/app/plugins/[slug]/plugin-detail-page-controller';
import type { IPluginDetailPageValues } from '@/app/plugins/[slug]/interfaces/plugin-detail-page-values.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginConsentHost } from '@/components/plugins/view/plugin-consent-host.client';
import { PluginNotFound } from '@/components/plugins/view/plugin-not-found.client';

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
          <Loader label={AdminI18n.t('plugins.detail.synchronizingPluginManifest')} />
        </div>
      );
    }

    // A slug this site cannot see (a bookmark, a plugin not enabled here) said so, not an empty page.
    if (!model.plugin) return <PluginNotFound pluginSlug={slug} />;

    return (
      <>
      <PluginConsentHost slugs={model.consentSlugs} initial={model.consentInitial}
        onApproved={() => undefined} onFinished={() => void model.consentFinished()} />
      <PluginDetailView
        activeTab={model.activeTab}
        settingsGroups={model.settingsGroups}
        settingsGroup={model.settingsGroup}
        settingsSection={model.settingsSection}
        isDeleting={model.isDeleting}
        isSaving={model.isSaving}
        isUpdating={model.isUpdating}
        installOperation={model.installOperation}
        isolationDefaults={model.isolationDefaults}
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
        onSettingsStateChange={(dirty: boolean, saving: boolean, hasFields: boolean) => {
          model.setSettingsDirty(dirty);
          model.setSettingsSaving(saving);
          model.setSettingsHasFields(hasFields);
        }}
        onTabChange={model.handleTabChange}
        onToggle={model.handleToggle}
        onUpdate={model.handleUpdate}
        plugin={model.plugin}
        sandboxSettings={model.sandboxSettings}
        settingsDirty={model.settingsDirty}
        settingsFormRef={model.settingsFormRef}
        settingsSaving={model.settingsSaving}
        settingsHasFields={model.settingsHasFields}
        showDefinition={model.showDefinition}
        showDeleteConfirm={model.showDeleteConfirm}
        siteScope={model.siteScope}
        slug={slug}
      />
      </>
    );
  }
}
