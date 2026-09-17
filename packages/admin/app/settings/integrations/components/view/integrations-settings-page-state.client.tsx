import { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import { AdminComponent } from '@/components/view/admin-component.client';
import { IntegrationSelectors } from '@/app/settings/integrations/integration-selectors';
import { prop, state } from '@fromcode119/react-class-components';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';

/**
 * What the integrations screen knows: the records it loaded, which type and provider are selected,
 * and the editor open over them.
 *
 * The base of this page's chain — reconciliation, then the provider actions, then the lifecycle and
 * the markup — each layer working over these same fields.
 *
 * `editor` being `null` is meaningful: nothing is being edited, which is NOT the same as editing a
 * provider whose fields happen to be empty. Both states exist and the screen renders them differently.
 */
export abstract class IntegrationsSettingsPageState extends AdminComponent {
  @prop declare searchParams?: Promise<Record<string, string | string[]>>;

  @state queryType = '';
  @state resolved = false;
  @state loading = true;
  @state saving = false;
  @state resettingStaleJs = false;
  @state changingProviderId: string | null = null;
  @state removeCandidateId: string | null = null;
  @state integrations: IIntegrationRecord[] = [];
  @state activeType = '';
  @state selectedProviderId = '';
  @state editor: IProviderEditorState | null = null;
  @state dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>> = {};
  @state dynamicFieldErrors: Record<string, string> = {};
  @state dynamicFieldLoading: Record<string, boolean> = {};

  protected mounted = false;
  protected readonly fieldOptionsService = new IntegrationsFieldOptionsService();
  protected fieldOptionsLoadToken = 0;
  protected prevReconcileKey = '';
  protected prevEditorBuildKey = '';
  protected prevDynamicKey = '';

  // ---- Derived selectors (replace useMemo) ----

  protected get integrationOptions(): Array<{ label: string; value: string }> {
    return IntegrationSelectors.integrationOptions(this.integrations);
  }

  protected get activeIntegration(): IIntegrationRecord | null {
    return IntegrationSelectors.activeIntegration(this.integrations, this.activeType);
  }

  protected get activeProviders(): IStoredProvider[] {
    return IntegrationSelectors.activeProviders(this.activeIntegration);
  }

  protected get runtimeProviderId(): string {
    return IntegrationSelectors.runtimeProviderId(this.activeIntegration);
  }

  protected get currentProviderDefinition(): IIntegrationProvider | null {
    return IntegrationSelectors.currentProviderDefinition(this.activeIntegration, this.editor);
  }

  protected get selectedProviderDefinition(): IIntegrationProvider | null {
    return IntegrationSelectors.selectedProviderDefinition(this.activeIntegration, this.selectedProviderId);
  }

  protected patchEditor(patch: Partial<IProviderEditorState> | ((prev: IProviderEditorState) => IProviderEditorState)): void {
    const previous = this.editor;
    if (!previous) return;
    this.editor = typeof patch === 'function' ? patch(previous) : { ...previous, ...patch };
  }
}
