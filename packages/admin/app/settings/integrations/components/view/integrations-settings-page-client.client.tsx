import { Heading } from '@/components/ui/view/heading.client';
import { Text } from '@/components/ui/view/text.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { AdminClass } from '@/lib/admin-class';
import type { ReactElement, ReactNode } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationSelectors } from '@/app/settings/integrations/integration-selectors';
import { Loader } from '@/components/ui/view/loader.client';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { IntegrationProviderList } from '@/app/settings/integrations/integration-provider-list';
import { IntegrationProviderEditor } from '@/app/settings/integrations/integration-provider-editor';
import { IntegrationExtraPanels } from '@/app/settings/integrations/integration-extra-panels';
import { IntegrationHeader } from '@/app/settings/integrations/integration-header';
import { IntegrationEmptyState } from '@/app/settings/integrations/integration-empty-state';
import { Platform } from '@fromcode119/react-class-components';
import { IntegrationsSettingsPageActions } from '@/app/settings/integrations/components/view/integrations-settings-page-actions.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { state, bound } from '@fromcode119/react-class-components';

/**
 * The integrations settings screen.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `IntegrationsSettingsPageState`.
 */
export class IntegrationsSettingsPageClient extends IntegrationsSettingsPageActions {
  /** Whether a panel below the providers (its own switch, a limit) holds something unsaved. */
  @state private panelsDirty = false;
  @state private panelsSaving = false;
  private stopPanels: (() => void) | null = null;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.stopPanels = PendingSaves.subscribe(this.readPanels);
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
    this.stopPanels?.();
  }

  @bound private readPanels(): void {
    const dirty = PendingSaves.anyDirty();
    if (dirty !== this.panelsDirty) this.panelsDirty = dirty;
  }

  /** The page's one bar saves the open provider and every panel below it that changed. */
  @bound private async saveAll(): Promise<void> {
    if (this.editorDirty) await this.handleSaveProvider();
    if (!PendingSaves.anyDirty()) return;
    this.panelsSaving = true;
    try {
      await PendingSaves.saveAll();
    } finally {
      this.panelsSaving = false;
      this.readPanels();
    }
  }

  @bound private discardAll(): void {
    if (this.editorDirty) this.discardEditorChanges();
    PendingSaves.discardAll();
  }

  /** Top row: who registered the types — the platform first, then each plugin. */
  private renderOwnerTabs(): ReactNode {
    // One owner is not a choice: a row holding a single tab said nothing and cost a line.
    if (this.ownerTabs.length < 2) return null;
    return (
      <Tabs variant="bar" value={this.activeOwner} label={AdminI18n.t('settings.integrations.ownerPlatform')}
        onChange={(slug: string) => {
          const first = IntegrationSelectors.typesOfOwner(this.integrations, slug)[0];
          if (first) this.activateType(first.key);
        }}
        tabs={this.ownerTabs.map((owner) => ({
          id: owner.slug,
          label: owner.slug ? owner.label : AdminI18n.t('settings.integrations.ownerPlatform'),
          icon: owner.slug ? <FrameworkIcons.Plugins size={15} /> : <FrameworkIcons.Settings size={15} />,
        }))} />
    );
  }

  /** Second, quieter row: the owner's types. Hidden when the owner has only one. */
  private renderTypeTabs(): ReactNode {
    const types = this.ownerTypes;
    if (types.length < 2) return null;
    return (
      <Tabs variant={this.ownerTabs.length < 2 ? 'bar' : 'second'} value={this.activeType} onChange={(key: string) => this.activateType(key)}
        tabs={types.map((type) => ({ id: type.key, label: type.label }))} />
    );
  }

  private renderBody(): ReactNode {
    const integration = this.activeIntegration;
    if (!integration) return null;
    const editor = this.editor;
    if (editor) {
      const removable = this.activeProviders.length > 1;
      return (
        <IntegrationProviderEditor
          activeIntegration={integration}
          editor={editor}
          currentProviderDefinition={this.currentProviderDefinition}
          fieldOptionsService={this.fieldOptionsService}
          dynamicFieldOptions={this.dynamicFieldOptions}
          dynamicFieldErrors={this.dynamicFieldErrors}
          dynamicFieldLoading={this.dynamicFieldLoading}
          patchEditor={(patch) => this.patchEditor(patch)}
          onSubmit={() => void this.handleSaveProvider()}
          onChooseProvider={(providerKey) => this.chooseProvider(providerKey)}
          onBack={() => this.closeEditor()}
          canRemove={removable}
          confirmingRemove={this.removeCandidateId === editor.providerId}
          removing={this.changingProviderId === editor.providerId}
          onRequestRemove={() => { this.removeCandidateId = editor.providerId; }}
          onCancelRemove={() => { this.removeCandidateId = null; }}
          onConfirmRemove={() => {
            const provider = this.activeProviders.find((entry) => entry.id === editor.providerId);
            if (provider) void this.handleRemoveProvider(provider);
          }}
        />
      );
    }
    // A type that declares NO providers is configured entirely by its own panel below.
    if (!integration.providers.length) {
      return (
        <div className="fc-field-stack">
          <Heading level="h2">{integration.label}</Heading>
          {integration.description ? <Text size="small" muted as="p">{integration.description}</Text> : null}
        </div>
      );
    }
    return (
      <IntegrationProviderList
        activeIntegration={integration}
        activeProviders={this.activeProviders}
        changingProviderId={this.changingProviderId}
        onAddProvider={() => this.startAddProvider()}
        onOpenProvider={(providerId) => this.openProvider(providerId)}
        onToggleProvider={(provider) => void this.handleToggleProvider(provider)}
      />
    );
  }

  render(): ReactElement {
    if (this.loading) {
      return (
        <div className="p-12">
          <Loader label={AdminI18n.t('settings.integrations.loadingIntegrationProviders')} />
        </div>
      );
    }

    if (this.platformOnlyType) {
      return <PlatformScopeGate page what={this.platformOnlyType.label}>{null}</PlatformScopeGate>;
    }

    if (!this.integrations.length) {
      return <IntegrationEmptyState />;
    }

    return (
      <div className="flex h-full flex-col animate-in fade-in duration-500">
        <IntegrationHeader
          theme={this.theme}
          resettingStaleJs={this.resettingStaleJs}
          onResetStaleJs={() => void this.handleResetStaleJavaScript()}
        />
        {/* The tabs stand on the page, at the page's own inset, the way a plugin's settings do: the first
            row with the line under it, the second under that. They were in a white band of their own
            that stopped short of both edges of the page. */}
        <div className="fc-tabstack">
          {this.renderOwnerTabs()}
          {this.renderTypeTabs()}
        </div>
        <div className="fc-tabstack__body">
          <section className="fc-columns__stack">
            {this.renderBody()}
            {/* Whatever this integration type contributes beyond providers-and-fields. Resolved from a
                registry so this page never names a type. Hidden while one provider is open in place of
                the list, so the editor stands alone. */}
            {this.editor && !this.singleProvider ? null : IntegrationExtraPanels.render(this.activeType)}
          </section>
          <SettingsSaveBar
            dirty={this.editorDirty || this.panelsDirty}
            saving={this.saving || this.panelsSaving}
            onSave={this.saveAll}
            onDiscard={this.discardAll}
          />
        </div>
      </div>
    );
  }
}
