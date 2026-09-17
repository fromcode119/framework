import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { bound, Platform } from '@fromcode119/react-class-components';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import { AdminAssistantPageGatewayService } from '@ai/admin-assistant-page/admin-assistant-page-gateway-service';
import { AdminAssistantPageLayout } from '@ai/admin-assistant-page/admin-assistant-page-layout';
import { AdminAssistantPageState } from '@ai/admin-assistant-page/admin-assistant-page-state';

/**
 * The model gateway: which provider, which model, and the credential that reaches it.
 *
 * The API key is WRITE-ONLY from here — the server never sends a stored secret back, so `apiKey` is
 * cleared after a save and `hasSavedSecret` is what the UI reads to know one exists. Model listing is
 * debounced because it is keyed on four fields an operator edits together.
 */
export class AdminAssistantPageGateway extends AdminAssistantPageLayout {

  @bound
  switchProvider(nextProvider: string): void {
    const resolved = AdminAssistantPageGatewayService.resolveProviderSwitch(nextProvider, AdminAssistantPageState.assistantBrowserState);
    if (!resolved.provider || resolved.provider === this.provider) return;
    this.provider = resolved.provider;
    this.model = resolved.model;
    this.baseUrl = resolved.baseUrl;
    this.providerModels = [];
    this.providerModelsError = '';
    this.apiKey = '';
    this.notice = '';
    this.error = '';
  }

  @bound
  openAdvancedWorkspace(): void {
    if (!Platform.isBrowser) return;
    try { AdminAssistantPageState.assistantBrowserState.enableAdvancedMode(); } catch {}
    window.location.assign(`${AdminAssistantPageUtils.getAdminNavigationPrefix(window.location.pathname) || ''}/`);
  }

  @bound
  async saveIntegration(values?: { apiKey?: string; baseUrl?: string }): Promise<void> {
    this.notice = '';
    this.error = '';
    this.integrationSaving = true;
    try {
      const nextApiKey = String(values?.apiKey ?? this.apiKey);
      const nextBaseUrl = String(values?.baseUrl ?? this.baseUrl);
      const result = await AdminAssistantPageGatewayService.saveIntegration(this.api, { provider: this.provider, apiKey: nextApiKey, model: this.model, baseUrl: nextBaseUrl, hasSavedSecret: this.hasSavedSecret });
      this.integrationConfigured = true;
      this.hasSavedSecret = result.hasSavedSecret;
      this.apiKey = '';
      this.baseUrl = nextBaseUrl;
      this.notice = 'Gateway saved.';
      this.messages = [...this.messages, { role: AssistantRole.SYSTEM, content: `Gateway updated (${this.provider}).` }];
    } catch (e: any) {
      this.error = String(e?.message || 'Failed to save gateway configuration.');
    } finally {
      this.integrationSaving = false;
    }
  }

  // --- data effect implementations ---
  protected async loadIntegration(): Promise<void> {
    this.checkingIntegration = true;
    try {
      const integration = await AdminAssistantPageGatewayService.fetchIntegration(this.api);
      if (this.cancelled) return;
      const provider = integration.provider || 'openai';
      this.provider = provider;
      this.model = integration.model || (AssistantConstants.PROVIDER_PRESETS[provider]?.[0]?.value || AssistantConstants.PROVIDER_PRESETS.openai[0].value);
      this.baseUrl = integration.baseUrl;
      this.integrationConfigured = integration.integrationConfigured;
      this.hasSavedSecret = integration.hasSavedSecret;
    } catch (error) {
      if (!this.cancelled) {
        if (!AdminAssistantPageGatewayService.isTransientBootstrapError(error)) {
          this.integrationConfigured = false;
          this.hasSavedSecret = false;
        }
      }
    } finally {
      if (!this.cancelled) this.checkingIntegration = false;
    }
  }

  protected scheduleProviderModels(): void {
    if (this.providerModelsTimer !== undefined) window.clearTimeout(this.providerModelsTimer);
    this.providerModelsTimer = undefined;
    if (this.checkingIntegration || !this.uiPrefsHydrated) return;
    this.providerModelsTimer = window.setTimeout(async () => {
      this.loadingProviderModels = true;
      const result = await AdminAssistantPageGatewayService.fetchProviderModels(this.api, { provider: this.provider, apiKey: this.apiKey, baseUrl: this.baseUrl, hasSavedSecret: this.hasSavedSecret, model: this.model });
      this.providerModels = result.models;
      this.providerModelsError = result.error;
      if (result.nextModel && result.nextModel !== this.model) this.model = result.nextModel;
      this.loadingProviderModels = false;
    }, 320);
  }

  protected async loadTools(): Promise<void> {
    try {
      const tools = await AdminAssistantPageGatewayService.fetchTools(this.api);
      if (this.cancelled) return;
      this.availableTools = tools;
      const next = this.selectedTools.filter((tool) => tools.some((entry) => entry.tool === tool));
      this.selectedTools = next.length > 0 ? next : tools.map((entry) => entry.tool);
    } catch (error) {
      if (!this.cancelled) {
        if (AdminAssistantPageGatewayService.isTransientBootstrapError(error)) return;
        this.availableTools = [];
        this.selectedTools = [];
      }
    }
  }

  protected async loadSkills(): Promise<void> {
    try {
      const skills = await AdminAssistantPageGatewayService.fetchSkills(this.api);
      if (this.cancelled) return;
      this.skills = skills;
      this.skillId = skills.some((entry) => entry.id === this.skillId) ? this.skillId : skills[0]?.id || 'general';
    } catch (error) {
      if (!this.cancelled) {
        if (AdminAssistantPageGatewayService.isTransientBootstrapError(error)) return;
        this.skills = [{ id: 'general', label: 'General' }];
        this.skillId = this.skillId || 'general';
      }
    }
  }
}
