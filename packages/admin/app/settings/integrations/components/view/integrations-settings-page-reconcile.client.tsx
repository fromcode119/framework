import { AdminConstants } from '@/lib/constants/admin.constants';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';
import { IntegrationReconciler } from '@/app/settings/integrations/integration-reconciler';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
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
    if (!integrations.length) return;

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

  protected reconcileEditor(): void {
    const activeIntegration = this.activeIntegration;
    const { selectedProviderId, editor } = this;
    const selectedProviderDefinition = this.selectedProviderDefinition;

    const key = IntegrationReconciler.editorBuildKey(activeIntegration, selectedProviderId, editor, selectedProviderDefinition);
    if (key === this.prevEditorBuildKey) return;
    this.prevEditorBuildKey = key;

    if (!activeIntegration) {
      if (editor) this.editor = null;
      return;
    }

    if (editor?.isNew) return;

    const providers = activeIntegration.storedProviders || [];
    if (!providers.length) {
      this.selectedProviderId = '';
      this.editor = null;
      return;
    }

    const selected = providers.find((provider) => provider.id === selectedProviderId) || providers[0];

    if (!selectedProviderId || selectedProviderId !== selected.id) {
      this.selectedProviderId = selected.id;
      return;
    }

    this.editor = IntegrationProviderFormHelper.buildEditorForProvider(selected, selectedProviderDefinition);
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

  protected applyIntegrationUpdate(updated: IIntegrationRecord): IIntegrationRecord {
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
