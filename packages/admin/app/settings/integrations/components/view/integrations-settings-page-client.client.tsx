import type { ReactElement } from 'react';
import { Card } from '@/components/ui/view/card.client';
import { Loader } from '@/components/ui/view/loader.client';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { IntegrationProviderList } from '@/app/settings/integrations/integration-provider-list';
import { IntegrationProviderEditor } from '@/app/settings/integrations/integration-provider-editor';
import { IntegrationExtraPanels } from '@/app/settings/integrations/integration-extra-panels';
import { IntegrationHeader } from '@/app/settings/integrations/integration-header';
import { IntegrationEmptyState } from '@/app/settings/integrations/integration-empty-state';
import { Platform } from '@fromcode119/react-class-components';
import { IntegrationsSettingsPageActions } from '@/app/settings/integrations/components/view/integrations-settings-page-actions.client';

/**
 * The integrations settings screen.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `IntegrationsSettingsPageState`.
 */
export class IntegrationsSettingsPageClient extends IntegrationsSettingsPageActions {
  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const searchParams = this.searchParams ? await this.searchParams : undefined;
    if (!this.mounted) return;
    // The `searchParams` promise resolves EMPTY on this route because the page is statically
    // prerendered, so `?type=` was lost and the reconcile below rewrote the URL to the first
    // integration — every deep link landed on "AI Assistant". The live URL is the source of truth on
    // the client; the promise stays as the SSR path.
    const fromPromise = String(searchParams?.type || '');
    const fromLocation = !Platform.hasWindow
      ? ''
      : String(new URLSearchParams(window.location.search).get('type') || '');
    this.queryType = IntegrationsPageUtils.normalizeKey(fromPromise || fromLocation);
    this.resolved = true;
    void this.loadIntegrations();
  }

  componentDidUpdate(): void {
    if (!this.resolved) return;
    this.reconcileActiveType();
    this.reconcileEditor();
    this.reconcileDynamicFieldOptions();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactElement {
    const theme = this.theme;
    const {
      loading,
      saving,
      resettingStaleJs,
      changingProviderId,
      removeCandidateId,
      activeType,
      selectedProviderId,
      editor,
      integrations,
      dynamicFieldOptions,
      dynamicFieldErrors,
      dynamicFieldLoading,
    } = this;
    const activeIntegration = this.activeIntegration;
    const activeProviders = this.activeProviders;
    const runtimeProviderId = this.runtimeProviderId;
    const currentProviderDefinition = this.currentProviderDefinition;

    if (loading) {
      return (
        <div className="p-12">
          <Loader label="Loading integration providers..." />
        </div>
      );
    }

    if (!integrations.length) {
      return <IntegrationEmptyState />;
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <IntegrationHeader
          theme={theme}
          activeType={activeType}
          integrationOptions={this.integrationOptions}
          resettingStaleJs={resettingStaleJs}
          onChangeType={(value) => this.activateType(value)}
          onResetStaleJs={() => void this.handleResetStaleJavaScript()}
        />

        <div className="p-8 lg:p-12 space-y-6">
          <Card className="p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {activeIntegration?.label || 'Integration'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {activeIntegration?.description || 'Configure provider instances for this integration.'}
                </p>
              </div>
            </div>
          </Card>

          {/* A type that declares NO providers gets no provider grid. Showing "add your first
              provider instance" for something that has none is an instruction the operator cannot
              follow — the type is configured entirely by its own panel below. */}
          {(activeIntegration?.providers?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <IntegrationProviderList
              activeIntegration={activeIntegration}
              activeProviders={activeProviders}
              selectedProviderId={selectedProviderId}
              editor={editor}
              removeCandidateId={removeCandidateId}
              changingProviderId={changingProviderId}
              runtimeProviderId={runtimeProviderId}
              onAddProvider={() => this.startAddProvider()}
              onSelectProvider={(providerId) => {
                this.removeCandidateId = null;
                this.editor = null;
                this.selectedProviderId = providerId;
              }}
              onToggleProvider={(provider) => void this.handleToggleProvider(provider)}
              onRequestRemove={(providerId) => { this.removeCandidateId = providerId; }}
              onCancelRemove={() => { this.removeCandidateId = null; }}
              onConfirmRemove={(provider) => void this.handleRemoveProvider(provider)}
            />

            <IntegrationProviderEditor
              activeIntegration={activeIntegration}
              editor={editor}
              currentProviderDefinition={currentProviderDefinition}
              saving={saving}
              fieldOptionsService={this.fieldOptionsService}
              dynamicFieldOptions={dynamicFieldOptions}
              dynamicFieldErrors={dynamicFieldErrors}
              dynamicFieldLoading={dynamicFieldLoading}
              patchEditor={(patch) => this.patchEditor(patch)}
              onSubmit={() => void this.handleSaveProvider()}
              onCancel={() => this.cancelNewProvider()}
              onReset={() => this.resetEditor()}
            />
          </div>
          )}

          {/* Whatever this integration type contributes beyond providers-and-fields. Resolved from a
              registry so this page never names a type. */}
          {IntegrationExtraPanels.render(activeType)}
        </div>
      </div>
    );
  }
}
