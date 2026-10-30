import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIntegrationCopy } from '@/app/settings/integrations/framework-integration-copy';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';
import { IntegrationReconciler } from '@/app/settings/integrations/integration-reconciler';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import { IntegrationsSettingsPageState } from '@/app/settings/integrations/components/view/integrations-settings-page-state.client';

/**
 * Keeping the selection consistent with what was actually loaded.
 *
 * Run from `componentDidUpdate`, so each reconciler compares against the key it last acted on and
 * does nothing when that key is unchanged — without those guards an update that reconciles state
 * triggers the update that reconciles it again, forever.
 *
 * Field options are fetched per provider and carry a token: an answer for a provider the operator
 * has already navigated away from is dropped rather than painted over the current one.
 */
export abstract class IntegrationsSettingsPageReconcile extends IntegrationsSettingsPageState {
  // ---- Effect reconciliation ----

  protected reconcileActiveType(): void {
    const { integrations, queryType, activeType } = this;
    // The page is showing where that type lives; rewriting the URL to another type would hide it.
    if (!integrations.length || this.platformOnlyType) return;

    const key = IntegrationReconciler.activeTypeKey(integrations, queryType, activeType);
    if (key === this.prevReconcileKey) return;
    this.prevReconcileKey = key;

    const hasActiveType = integrations.some((integration) => integration.key === activeType);
    const hasQueryType = !!queryType && integrations.some((integration) => integration.key === queryType);
    const nextType = hasQueryType ? queryType : hasActiveType ? activeType : integrations[0].key;

    if (nextType !== activeType) {
      this.activeType = nextType;
      this.selectedProviderId = '';
      this.editor = null;
      return;
    }

    if (!hasQueryType && nextType) {
      this.router.replace(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(nextType));
    }
  }

  /**
   * A type with several providers shows its list until a provider is opened, and closes an editor whose
   * provider is gone. A one-provider type is a form: it always has an editor, for the provider in use or,
   * when nothing is saved yet, a new one for the type's default.
   */
  protected reconcileEditor(): void {
    const activeIntegration = this.activeIntegration;
    const editor = this.editor;
    if (!activeIntegration) {
      if (editor) this.editor = null;
      return;
    }

    const providers = activeIntegration.storedProviders || [];
    if (activeIntegration.allowMultipleActiveProviders) {
      if (editor && !editor.isNew && !providers.some((provider) => provider.id === editor.providerId)) this.editor = null;
      return;
    }

    if (editor) return;
    const inUse = providers.find((provider) => provider.enabled !== false) || providers[0];
    if (inUse) {
      this.selectedProviderId = inUse.id;
      this.editor = IntegrationProviderFormHelper.buildEditorForProvider(inUse, this.definitionOf(inUse.providerKey));
      return;
    }
    const fallback = this.definitionOf(activeIntegration.defaultProvider) || activeIntegration.providers[0];
    if (fallback) this.editor = this.newEditorFor(fallback.key);
  }

  protected definitionOf(providerKey: string): IIntegrationProvider | null {
    return this.activeIntegration?.providers.find((provider) => provider.key === providerKey) || null;
  }

  protected newEditorFor(providerKey: string): IProviderEditorState {
    return {
      isNew: true,
      providerId: '',
      providerKey,
      providerName: '',
      enabled: true,
      config: IntegrationsPageUtils.defaultConfigForFields(this.definitionOf(providerKey)?.fields),
      preservedSecretFields: {},
    };
  }

  protected reconcileDynamicFieldOptions(): void {
    const editor = this.editor;
    const currentProviderDefinition = this.currentProviderDefinition;

    const key = IntegrationReconciler.dynamicKey(currentProviderDefinition, editor);
    if (key === this.prevDynamicKey) return;
    this.prevDynamicKey = key;

    if (!editor || !currentProviderDefinition) {
      this.dynamicFieldOptions = {};
      this.dynamicFieldErrors = {};
      this.dynamicFieldLoading = {};
      return;
    }

    const dynamicFields = IntegrationReconciler.dynamicFields(currentProviderDefinition);

    if (!dynamicFields.length) {
      this.dynamicFieldOptions = {};
      this.dynamicFieldErrors = {};
      this.dynamicFieldLoading = {};
      return;
    }

    const token = ++this.fieldOptionsLoadToken;
    const providerId = editor.isNew ? '' : editor.providerId;
    const initialLoadingState = IntegrationReconciler.initialLoadingState(this.fieldOptionsService, dynamicFields, providerId, editor.providerKey);

    this.dynamicFieldLoading = initialLoadingState;
    this.dynamicFieldErrors = {};

    void this.applyFieldOptions(editor, dynamicFields, providerId, token);
  }

  protected async applyFieldOptions(
    editor: IProviderEditorState,
    dynamicFields: IIntegrationConfigField[],
    providerId: string,
    token: number,
  ): Promise<void> {
    const next = await IntegrationReconciler.loadFieldOptions(this.fieldOptionsService, editor, dynamicFields, providerId);
    if (!this.mounted || token !== this.fieldOptionsLoadToken) return;
    this.dynamicFieldOptions = next.dynamicFieldOptions;
    this.dynamicFieldErrors = next.dynamicFieldErrors;
    this.dynamicFieldLoading = next.dynamicFieldLoading;
  }

  // ---- Actions ----

  protected applyIntegrationUpdate(saved: IIntegrationRecord): IIntegrationRecord {
    const updated = FrameworkIntegrationCopy.localize(saved);
    const exists = this.integrations.some((integration) => integration.key === updated.key);
    if (exists) {
      this.integrations = this.integrations.map((integration) => (integration.key === updated.key ? updated : integration));
    }
    return updated;
  }

  protected activateType(typeKey: string): void {
    const normalized = IntegrationsPageUtils.normalizeKey(typeKey);
    if (!normalized || normalized === this.activeType) return;
    // The query type moves WITH the selection. `queryType` is captured at mount and treated as
    // authoritative by `reconcileActiveType`; leaving it on the mounted value made every dropdown
    // change revert on the next reconcile — the URL said one type, the user had picked another, and
    // the URL won.
    this.queryType = normalized;
    this.activeType = normalized;
    this.selectedProviderId = '';
    this.editor = null;
    this.removeCandidateId = null;
    this.router.replace(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(normalized));
  }
}
