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
 * `editor` being `null` is meaningful. For a type that allows several providers it is the list; an editor
 * replaces the list in place until it is saved or left. A one-provider type always has an editor: its
 * page IS the form.
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
  /** A `?type=` that exists but belongs to the platform, asked for while standing in a site. */
  @state platformOnlyType: { key: string; label: string } | null = null;
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
  protected prevDynamicKey = '';

  // ---- Derived selectors (replace useMemo) ----

  protected get ownerTabs(): Array<{ slug: string; label: string }> {
    return IntegrationSelectors.ownerTabs(this.integrations);
  }

  /** The owner whose types are shown: the one the active type belongs to. */
  protected get activeOwner(): string {
    return this.activeIntegration?.owner?.slug || '';
  }

  protected get ownerTypes(): IIntegrationRecord[] {
    return IntegrationSelectors.typesOfOwner(this.integrations, this.activeOwner);
  }

  /** One provider at a time: the type is edited as a single form, never as a list. */
  protected get singleProvider(): boolean {
    return !!this.activeIntegration && !this.activeIntegration.allowMultipleActiveProviders;
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

  protected patchEditor(patch: Partial<IProviderEditorState> | ((prev: IProviderEditorState) => IProviderEditorState)): void {
    const previous = this.editor;
    if (!previous) return;
    this.editor = typeof patch === 'function' ? patch(previous) : { ...previous, ...patch };
  }
}
