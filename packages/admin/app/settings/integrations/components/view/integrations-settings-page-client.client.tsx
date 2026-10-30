import type { ReactElement, ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
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

  private tab(key: string, label: string, icon: ReactNode, active: boolean, onClick: () => void): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const tone = active
      ? (dark ? 'text-white border-indigo-500' : 'text-slate-900 border-indigo-600')
      : (dark ? 'text-slate-400 border-transparent hover:text-slate-200' : 'text-slate-500 border-transparent hover:text-slate-800');
    return (
      <button key={key} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
        className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3.5 text-[13px] transition-colors ${active ? 'font-semibold' : 'font-medium'} ${tone}`}>
        {icon}
        {label}
      </button>
    );
  }

  /** Top row: who registered the types — the platform first, then each plugin. */
  private renderOwnerTabs(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const activeOwner = this.activeOwner;
    return (
      <nav className={`flex gap-6 overflow-x-auto [scrollbar-width:none] px-6 border-b ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
        {this.ownerTabs.map((owner) => this.tab(
          `owner-${owner.slug}`,
          owner.slug ? owner.label : AdminI18n.t('settings.integrations.ownerPlatform'),
          owner.slug ? <FrameworkIcons.Plugins size={15} /> : <FrameworkIcons.Settings size={15} />,
          owner.slug === activeOwner,
          () => {
            const first = IntegrationSelectors.typesOfOwner(this.integrations, owner.slug)[0];
            if (first) this.activateType(first.key);
          },
        ))}
      </nav>
    );
  }

  /** Second, quieter row: the owner's types. Hidden when the owner has only one. */
  private renderTypeTabs(): ReactNode {
    const types = this.ownerTypes;
    if (types.length < 2) return null;
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className={`flex gap-6 overflow-x-auto [scrollbar-width:none] border-b px-6 text-[12.5px] ${dark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
        {types.map((type) => (
          <button type="button" key={type.key} onClick={() => this.activateType(type.key)} aria-current={type.key === this.activeType ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 py-2.5 transition-colors ${type.key === this.activeType
              ? (dark ? 'border-indigo-300 text-white' : 'border-indigo-500 text-slate-900')
              : (dark ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800')}`}>
            {type.label}
          </button>
        ))}
      </div>
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
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{integration.label}</h2>
          {integration.description ? <p className="mt-1 text-[12px] text-slate-500">{integration.description}</p> : null}
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
      return <div className="p-8 lg:p-12"><PlatformScopeGate what={this.platformOnlyType.label}>{null}</PlatformScopeGate></div>;
    }

    if (!this.integrations.length) {
      return <IntegrationEmptyState />;
    }

    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="w-full space-y-5 p-8 pb-12 lg:p-12 animate-in fade-in duration-300">
        <IntegrationHeader
          theme={this.theme}
          formId={this.editor ? IntegrationProviderEditor.FORM_ID : ''}
          saving={this.saving}
          resettingStaleJs={this.resettingStaleJs}
          onResetStaleJs={() => void this.handleResetStaleJavaScript()}
        />
        <section className={`overflow-hidden rounded-2xl border ${dark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
          {this.renderOwnerTabs()}
          {this.renderTypeTabs()}
          <div className="space-y-6 p-6">
            {this.renderBody()}
            {/* Whatever this integration type contributes beyond providers-and-fields. Resolved from a
                registry so this page never names a type. Hidden while one provider is open in place of
                the list, so the editor stands alone. */}
            {this.editor && !this.singleProvider ? null : IntegrationExtraPanels.render(this.activeType)}
          </div>
        </section>
      </div>
    );
  }
}
