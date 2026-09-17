import { ThemeMode } from '@fromcode119/core/client';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { SidebarOverlay } from '@ai/enums/sidebar-overlay.enum';
import { AssistantViewport } from '@ai/enums/assistant-viewport.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { ModelLocation } from '@ai/api/forge/enums/model-location.enum';
import type { SetStateAction } from 'react';
import { Reactor, state, bound, ref, Ref } from '@fromcode119/react-class-components';
import { PluginContextRegistry } from '@fromcode119/react';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import { AssistantProviderUtils } from '@ai/assistant-provider-utils';
import { AssistantTextUtils } from '@ai/assistant-text-utils';
import { AdminAssistantBrowserStateService } from '@ai/services/admin-assistant-browser-state-service';
import { AdminAssistantMessageService } from '@ai/admin-assistant-page/admin-assistant-message-service';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import { SelectOption } from '@ai/ui/select-option';
import type { IAssistantLayoutState } from '@ai/interfaces/assistant-layout-state.interface';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IAssistantSkill } from '@ai/interfaces/assistant-skill.interface';
import type { IAssistantToolOption } from '@ai/interfaces/assistant-tool-option.interface';
import type { IUploadedAttachment } from '@ai/interfaces/uploaded-attachment.interface';
import type { IForgeHistorySession } from '@ai/interfaces/forge-history-session.interface';

/**
 * Everything the admin-assistant page KNOWS: its reactive fields, its refs, and the values derived
 * from them.
 *
 * The base of the page's chain. Each link above it adds one kind of behaviour over this same state —
 * storage, layout, gateway, sessions, conversation — and the controller at the top wires them to the
 * lifecycle. They are a chain rather than siblings because each genuinely builds on the one below:
 * the conversation sends through the gateway, the gateway's answers are persisted by storage, and
 * every one of them reads these fields.
 *
 * Derived values are getters, never computed in `render()`.
 */
export class AdminAssistantPageState extends Reactor {
  protected static readonly assistantBrowserState = new AdminAssistantBrowserStateService();

  static contextType = PluginContextRegistry.Context;
  protected get api(): any {
    return (this.context as any)?.api;
  }

  @state messages: IAssistantMessage[] = AdminAssistantPageUtils.createReadyConversation();
  @state prompt = '';
  @state loading = false;
  @state executing = false;
  @state error = '';
  @state notice = '';
  @state historySessions: IForgeHistorySession[] = [];
  @state activeSessionId = '';
  @state historyHydrated = false;
  @state historySource: ModelLocation = ModelLocation.SERVER;
  @state historyLoading = false;
  @state provider = 'openai';
  @state apiKey = '';
  @state model = AssistantConstants.PROVIDER_PRESETS.openai[0].value;
  @state baseUrl = '';
  @state skills: IAssistantSkill[] = [{ id: 'general', label: 'General' }];
  @state skillId = 'general';
  @state checkingIntegration = true;
  @state integrationConfigured = false;
  @state integrationSaving = false;
  @state hasSavedSecret = false;
  @state providerModels: Array<{ value: string; label: string }> = [];
  @state loadingProviderModels = false;
  @state providerModelsError = '';
  @state availableTools: IAssistantToolOption[] = [];
  @state selectedTools: string[] = [];
  @state showTools = false;
  @state selectedActionIndexes: number[] = [];
  @state attachments: IUploadedAttachment[] = [];
  @state uploadingAttachments = false;
  @state loadingPhaseIndex = 0;
  @state uiPrefsHydrated = false;
  @state autoApprove = false;
  @state showTechnicalDetails = false;
  @state verboseLogging = false;
  @state themeMode: ThemeMode = ThemeMode.LIGHT;
  @state chatMode: ChatMode = ChatMode.AUTO;
  @state sandboxMode = true;
  @state layoutState: IAssistantLayoutState = { viewport: AssistantViewport.DESKTOP, leftOpen: true, rightOpen: true, overlay: SidebarOverlay.NONE };
  @state batchExecutionSummaries: Record<string, { ok: number; unchanged: number; failed: number }> = {};
  @state toolsMenuStyle: { left: number; top: number; width: number } | null = null;

  @ref declare viewportRef: Ref<HTMLDivElement>;
  @ref declare scrollAnchorRef: Ref<HTMLDivElement>;
  @ref declare textareaRef: Ref<HTMLTextAreaElement>;
  @ref declare toolsMenuRef: Ref<HTMLDivElement>;
  @ref declare toolsButtonRef: Ref<HTMLButtonElement>;
  @ref declare toolsDropdownRef: Ref<HTMLDivElement>;
  @ref declare fileInputRef: Ref<HTMLInputElement>;
  @ref declare composerRef: Ref<HTMLDivElement>;

  readonly followDistanceThreshold = 220;
  readonly providerOptions = [...AssistantConstants.PROVIDER_OPTIONS];

  protected followLatest = true;
  protected cancelled = false;
  protected prefsLoaded = false;
  protected historyHydratedInternal = false;
  protected historyHydrationInFlight = false;
  protected pinCleanup?: () => void;
  protected layoutPinCleanup?: () => void;
  protected historyPinCleanup?: () => void;
  protected toolsMenuCleanup?: () => void;
  protected mobileEscCleanup?: () => void;
  protected providerModelsTimer?: number;

  // --- derived values (render/view read these; never compute in render) ---
  get activeBatchEntry() {
    return AdminAssistantMessageService.getActiveBatchEntry(this.messages);
  }
  get visibleMessages(): IAssistantMessage[] {
    return AssistantTextUtils.stripReadyMessage(this.messages);
  }
  get modelOptions(): SelectOption[] {
    return this.providerModels.length > 0
      ? this.providerModels.map(SelectOption.from)
      : (AssistantConstants.PROVIDER_PRESETS[this.provider] || []).map(SelectOption.from);
  }
  get skillOptions(): SelectOption[] {
    return this.skills.map((entry) => new SelectOption(entry.id, entry.label || entry.id));
  }
  get conversationMode(): ConversationMode {
    return AssistantProviderUtils.chatModeToConversationMode(this.chatMode);
  }
  get isMobileViewport(): boolean {
    return this.layoutState.viewport === AssistantViewport.MOBILE;
  }
  get showHistory(): boolean {
    return this.isMobileViewport ? this.layoutState.overlay === SidebarOverlay.LEFT : this.layoutState.leftOpen;
  }
  get showGateway(): boolean {
    return this.isMobileViewport ? this.layoutState.overlay === SidebarOverlay.RIGHT : this.layoutState.rightOpen;
  }
  get lastActions() {
    return this.activeBatchEntry?.actions || [];
  }
  get activeBatchId(): string {
    return String(this.activeBatchEntry?.actionBatch?.id || '').trim();
  }
  get selectedActionCount(): number {
    return this.selectedActionIndexes.filter((index) => index >= 0 && index < this.lastActions.length).length;
  }
  get hasConversation(): boolean {
    return this.visibleMessages.length > 0;
  }
  get activeBatchSummary(): { ok: number; unchanged: number; failed: number } | undefined {
    return this.activeBatchId ? this.batchExecutionSummaries[this.activeBatchId] : undefined;
  }
  get promptUsage(): string {
    return `${this.prompt.length}/${AssistantConstants.MAX_PROMPT_LENGTH}`;
  }
  get activeTools(): number {
    return this.selectedTools.length;
  }
  get totalTools(): number {
    return this.availableTools.length;
  }
  get quickPrompts(): string[] {
    return [...AdminAssistantPageUtils.QUICK_PROMPTS];
  }

  // --- child-facing setters (value or updater fn, mirroring React.Dispatch) ---
  @bound setPrompt(value: SetStateAction<string>): void { this.prompt = typeof value === 'function' ? value(this.prompt) : value; }
  @bound setModel(value: SetStateAction<string>): void { this.model = typeof value === 'function' ? value(this.model) : value; }
  @bound setApiKey(value: SetStateAction<string>): void { this.apiKey = typeof value === 'function' ? value(this.apiKey) : value; }
  @bound setBaseUrl(value: SetStateAction<string>): void { this.baseUrl = typeof value === 'function' ? value(this.baseUrl) : value; }
  @bound setSkillId(value: SetStateAction<string>): void { this.skillId = typeof value === 'function' ? value(this.skillId) : value; }
  @bound setChatMode(value: SetStateAction<ChatMode>): void { this.chatMode = typeof value === 'function' ? value(this.chatMode) : value; }
  @bound setShowTools(value: SetStateAction<boolean>): void { this.showTools = typeof value === 'function' ? value(this.showTools) : value; }
  @bound setSelectedTools(value: SetStateAction<string[]>): void { this.selectedTools = typeof value === 'function' ? value(this.selectedTools) : value; }
  @bound setAutoApprove(value: SetStateAction<boolean>): void { this.autoApprove = typeof value === 'function' ? value(this.autoApprove) : value; }
  @bound setShowTechnicalDetails(value: SetStateAction<boolean>): void { this.showTechnicalDetails = typeof value === 'function' ? value(this.showTechnicalDetails) : value; }
  @bound setVerboseLogging(value: SetStateAction<boolean>): void { this.verboseLogging = typeof value === 'function' ? value(this.verboseLogging) : value; }
}
