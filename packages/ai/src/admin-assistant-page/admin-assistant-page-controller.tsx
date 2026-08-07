import { ThemeMode } from '@fromcode119/core/client';
import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { PrimaryAction } from '@ai/enums/primary-action.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { WorkflowState } from '@ai/enums/workflow-state.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { SidebarOverlay } from '@ai/enums/sidebar-overlay.enum';
import { AssistantViewport } from '@ai/enums/assistant-viewport.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { ModelLocation } from '@ai/api/forge/enums/model-location.enum';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, SetStateAction } from 'react';
import { Reactor, state, bound, watch, ref, Platform, Ref } from '@fromcode119/reactor';
import { PluginContextRegistry } from '@fromcode119/react';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import { AssistantProviderUtils } from '@ai/assistant-provider-utils';
import { AssistantTextUtils } from '@ai/assistant-text-utils';
import { AdminAssistantBrowserStateService } from '@ai/services/admin-assistant-browser-state-service';
import { AdminAssistantMessageService } from '@ai/admin-assistant-page/admin-assistant-message-service';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import { AdminAssistantPageGatewayService } from '@ai/admin-assistant-page/admin-assistant-page-gateway-service';
import { AdminAssistantPageSessionService } from '@ai/admin-assistant-page/admin-assistant-page-session-service';
import { AdminAssistantPageExecutionService } from '@ai/admin-assistant-page/admin-assistant-page-execution-service';
import { AdminAssistantPageView } from '@ai/admin-assistant-page/admin-assistant-page-view';
import { SelectOption } from '@ai/ui/select-option';
import type { IAssistantLayoutState } from '@ai/interfaces/assistant-layout-state.interface';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IAssistantSkill } from '@ai/interfaces/assistant-skill.interface';
import type { IAssistantToolOption } from '@ai/interfaces/assistant-tool-option.interface';
import type { IUploadedAttachment } from '@ai/interfaces/uploaded-attachment.interface';
import type { IForgeHistorySession } from '@ai/interfaces/forge-history-session.interface';
import { AssistantPlanStatus } from '@ai/admin-assistant-runtime/enums/assistant-plan-status.enum';

/**
 * The admin-assistant page controller — the reactive "model" behind the presentational view. All state,
 * derived getters, handlers, and the (formerly separate) mount/data/history effects live here as class
 * members; `render()` hands `this` to `AdminAssistantPageView`. Class-based (reactor): `@state` reactive
 * fields, getters for derived values, `@bound` handlers, and lifecycle-folded effects — no hooks.
 */
export class AdminAssistantPageController extends Reactor {
  private static readonly assistantBrowserState = new AdminAssistantBrowserStateService();

  static contextType = PluginContextRegistry.Context;
  private get api(): any {
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

  private followLatest = true;
  private cancelled = false;
  private prefsLoaded = false;
  private historyHydratedInternal = false;
  private historyHydrationInFlight = false;
  private pinCleanup?: () => void;
  private layoutPinCleanup?: () => void;
  private historyPinCleanup?: () => void;
  private toolsMenuCleanup?: () => void;
  private mobileEscCleanup?: () => void;
  private providerModelsTimer?: number;

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

  // --- layout / scroll helpers ---
  @bound
  private autoResizeTextArea(): void {
    const area = this.textareaRef.current;
    if (!area) return;
    area.style.height = '0px';
    area.style.height = `${Math.min(Math.max(area.scrollHeight, 56), 180)}px`;
  }

  private scrollToBottom(behavior: ScrollBehavior = 'auto', force = false): void {
    const viewport = this.viewportRef.current;
    if (!viewport || (!force && !this.followLatest)) return;
    const top = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (behavior === 'auto') viewport.scrollTop = top;
    else viewport.scrollTo({ top, behavior });
    if (Math.abs(viewport.scrollTop - top) > 2) viewport.scrollTop = top;
    this.followLatest = true;
  }

  private pinToBottom(preferredBehavior: ScrollBehavior = 'auto'): () => void {
    this.scrollToBottom(preferredBehavior, true);
    if (!Platform.isBrowser) return () => {};
    const rafA = window.requestAnimationFrame(() => this.scrollToBottom('auto', true));
    const rafB = window.requestAnimationFrame(() => window.requestAnimationFrame(() => this.scrollToBottom('auto', true)));
    const t1 = window.setTimeout(() => this.scrollToBottom('auto', true), 80);
    const t2 = window.setTimeout(() => this.scrollToBottom('auto', true), 220);
    const t3 = window.setTimeout(() => this.scrollToBottom('auto', true), 420);
    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }

  @bound
  private updateToolsMenuPosition(): void {
    if (!this.showTools || !this.toolsButtonRef.current || !Platform.isBrowser) return;
    const rect = this.toolsButtonRef.current.getBoundingClientRect();
    const menuWidth = Math.min(340, Math.max(280, Math.round(rect.width + 52)));
    const viewportPadding = 8;
    const measuredHeight = this.toolsDropdownRef.current?.offsetHeight || 340;
    let top = rect.bottom + 8;
    if (top + measuredHeight > window.innerHeight - viewportPadding) top = Math.max(viewportPadding, rect.top - measuredHeight - 8);
    const left = Math.min(Math.max(viewportPadding, rect.right - menuWidth), Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding));
    this.toolsMenuStyle = { left, top, width: menuWidth };
  }

  @bound
  private syncViewport(): void {
    if (!Platform.isBrowser) return;
    const nextViewport = window.innerWidth <= 900 ? AssistantViewport.MOBILE : AssistantViewport.DESKTOP;
    if (this.layoutState.viewport === nextViewport) return;
    this.layoutState = { ...this.layoutState, viewport: nextViewport, overlay: SidebarOverlay.NONE };
  }

  // --- panel toggles ---
  @bound toggleHistoryPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.LEFT ? SidebarOverlay.NONE : SidebarOverlay.LEFT } : { ...this.layoutState, leftOpen: !this.layoutState.leftOpen }; }
  @bound toggleSettingsPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.RIGHT ? SidebarOverlay.NONE : SidebarOverlay.RIGHT } : { ...this.layoutState, rightOpen: !this.layoutState.rightOpen }; }
  @bound closeHistoryPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.LEFT ? SidebarOverlay.NONE : this.layoutState.overlay } : { ...this.layoutState, leftOpen: false }; }
  @bound closeSettingsPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.RIGHT ? SidebarOverlay.NONE : this.layoutState.overlay } : { ...this.layoutState, rightOpen: false }; }
  @bound toggleThemeMode(): void { this.themeMode = this.themeMode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK; }

  @bound
  switchProvider(nextProvider: string): void {
    const resolved = AdminAssistantPageGatewayService.resolveProviderSwitch(nextProvider, AdminAssistantPageController.assistantBrowserState);
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
    try { AdminAssistantPageController.assistantBrowserState.enableAdvancedMode(); } catch {}
    window.location.assign(`${AdminAssistantPageUtils.getAdminNavigationPrefix(window.location.pathname) || ''}/`);
  }

  @bound
  startNewSession(): void {
    this.followLatest = true;
    this.messages = AdminAssistantPageUtils.createReadyConversation();
    this.prompt = '';
    this.attachments = [];
    this.selectedActionIndexes = [];
    this.activeSessionId = AdminAssistantPageUtils.createSessionId();
    if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
    this.notice = '';
    this.error = '';
  }

  private async refreshHistoryIfServer(): Promise<void> {
    if (this.historySource !== ModelLocation.SERVER) return;
    try {
      const sessions = await AdminAssistantPageSessionService.refreshServerHistory(this.api, this.provider);
      this.historySessions = sessions;
    } catch {}
  }

  @bound
  async openHistorySession(sessionId: string): Promise<void> {
    const localSession = this.historySessions.find((item) => item.id === sessionId);
    if (!localSession) return;
    try {
      if (this.historySource === ModelLocation.SERVER) {
        const remoteSession = await AdminAssistantPageSessionService.fetchSession(this.api, sessionId, this.provider);
        if (remoteSession) {
          this.historySessions = [remoteSession, ...this.historySessions.filter((item) => item.id !== remoteSession.id)];
          this.activeSessionId = remoteSession.id;
          this.messages = remoteSession.messages.length ? remoteSession.messages : AdminAssistantPageUtils.createReadyConversation();
          this.provider = remoteSession.provider || 'openai';
          if (remoteSession.model) this.model = remoteSession.model;
          if (remoteSession.skillId) this.skillId = remoteSession.skillId;
          this.chatMode = remoteSession.chatMode || ChatMode.AUTO;
          this.sandboxMode = remoteSession.sandboxMode !== false;
          if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
          this.followLatest = true;
          return;
        }
      }
    } catch {}
    this.activeSessionId = localSession.id;
    this.messages = localSession.messages.length ? localSession.messages : AdminAssistantPageUtils.createReadyConversation();
    this.provider = localSession.provider || 'openai';
    if (localSession.model) this.model = localSession.model;
    if (localSession.skillId) this.skillId = localSession.skillId;
    this.chatMode = localSession.chatMode || ChatMode.AUTO;
    this.sandboxMode = localSession.sandboxMode !== false;
    if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
    this.followLatest = true;
  }

  @bound
  removeHistorySession(sessionId: string): void {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    if (this.historySource === ModelLocation.SERVER) {
      void (async () => {
        try { await AdminAssistantPageSessionService.deleteSession(this.api, normalized); } catch {} finally {
          this.historySessions = this.historySessions.filter((item) => item.id !== normalized);
          if (this.activeSessionId === normalized) this.startNewSession();
        }
      })();
      return;
    }
    this.historySessions = this.historySessions.filter((item) => item.id !== normalized);
    if (this.activeSessionId === normalized) this.startNewSession();
  }

  @bound
  forkFromVisibleMessage(visibleIndex: number): void {
    const branch = this.visibleMessages.slice(0, visibleIndex + 1);
    if (!branch.length) return;
    const localFallback = () => {
      const forked = AdminAssistantPageSessionService.createForkedConversation(branch);
      this.activeSessionId = forked.sessionId;
      this.messages = forked.messages;
      if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
      this.notice = 'Forked to a new session from this message.';
      this.error = '';
    };
    if (this.historySource !== ModelLocation.SERVER || !this.activeSessionId) { localFallback(); return; }
    void (async () => {
      try {
        const forked = await AdminAssistantPageSessionService.forkSession(this.api, this.activeSessionId, visibleIndex, this.provider);
        if (!forked) return localFallback();
        this.historySessions = [forked, ...this.historySessions.filter((item) => item.id !== forked.id)];
        this.activeSessionId = forked.id;
        this.messages = forked.messages.length ? forked.messages : AdminAssistantPageUtils.createReadyConversation();
        if (forked.provider) this.provider = forked.provider;
        if (forked.model) this.model = forked.model;
        if (forked.skillId) this.skillId = forked.skillId;
        this.chatMode = forked.chatMode || ChatMode.AUTO;
        this.sandboxMode = forked.sandboxMode !== false;
        if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
        this.notice = 'Forked to a new session from this message.';
        this.error = '';
      } catch { localFallback(); }
    })();
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

  @bound
  async sendPrompt(): Promise<void> {
    const content = String(this.prompt).trim();
    if (!content || this.loading) return;
    const modeSwitchTarget = AdminAssistantPageUtils.parseModeSwitchCommand(content);
    if (modeSwitchTarget) {
      const label = modeSwitchTarget === ConversationMode.QUICKFIX ? 'Quick Fix' : modeSwitchTarget === ConversationMode.BUILD ? 'Build' : 'Chat';
      this.error = '';
      this.notice = `${label} mode enabled.`;
      this.chatMode = AssistantProviderUtils.conversationModeToChatMode(modeSwitchTarget);
      this.prompt = '';
      requestAnimationFrame(() => this.textareaRef.current?.focus());
      return;
    }
    if (!this.integrationConfigured) { this.error = 'Configure gateway first.'; return; }
    if (AdminAssistantPageExecutionService.shouldAutoApprove(content, this.lastActions, this.selectedActionCount, this.executing)) {
      this.messages = [...this.messages, { role: AssistantRole.USER, content }];
      this.prompt = '';
      await this.runActions(this.activeBatchEntry?.actionBatch?.state !== BatchState.PREVIEWED);
      return;
    }
    this.error = '';
    this.notice = '';
    this.followLatest = true;
    const request = AdminAssistantPageExecutionService.buildChatRequest({ content, messages: this.messages, attachments: this.attachments, activeSessionId: this.activeSessionId, provider: this.provider, model: this.model, baseUrl: this.baseUrl, skillId: this.skillId, availableTools: this.availableTools, selectedTools: this.selectedTools, chatMode: this.chatMode });
    this.messages = [...this.messages, request.userMessage];
    this.prompt = '';
    this.loading = true;
    if (!this.activeSessionId) this.activeSessionId = request.sessionId;
    try {
      const result = await AdminAssistantPageExecutionService.requestAssistantResponse(this.api, request.requestBody);
      const assistantMessage = AdminAssistantPageExecutionService.buildAssistantMessage(result, this.model, this.provider);
      if (assistantMessage.sessionId) this.activeSessionId = String(assistantMessage.sessionId);
      this.messages = AdminAssistantPageExecutionService.appendAssistantMessage(this.messages, assistantMessage);
      this.attachments = [];
      void this.refreshHistoryIfServer();
      if (this.chatMode === ChatMode.AUTO && assistantMessage.ui?.suggestedMode === ChatMode.AGENT) this.notice = 'Auto mode used agent loop for this request.';
      else if (this.chatMode === ChatMode.AUTO && assistantMessage.ui?.suggestedMode === ChatMode.PLAN) this.notice = 'Auto mode used planning for this request.';
      else if (assistantMessage.actions?.length) this.notice = 'Changes ready for review.';
      else if (assistantMessage.ui?.needsClarification) this.notice = String(assistantMessage.ui?.clarifyingQuestion || '').trim() || 'Need one detail to finish staging safely.';
      else if (assistantMessage.ui?.loopRecoveryMode === ClarifyMode.BEST_EFFORT) this.notice = 'Draft generated. Confirm target collection + record to stage actions.';
      else if (assistantMessage.ui?.canContinue) this.notice = 'Need another planning pass before staging final actions.';
      else if (request.requestBody.agentMode === 'advanced' && assistantMessage.loopCapReached && (!assistantMessage.actions || assistantMessage.actions.length === 0)) this.notice = 'No safe executable plan was generated yet. Try a more specific target (collection + id/slug + exact field).';
    } catch (e: any) {
      const requestError = String(e?.message || 'Request failed');
      this.error = requestError;
      this.messages = [...this.messages, { role: AssistantRole.SYSTEM, content: `Request failed: ${requestError}` }];
    } finally {
      this.loading = false;
    }
  }

  @bound
  async runActions(dryRun: boolean): Promise<void> {
    if (!this.lastActions.length || this.executing) return;
    this.executing = true;
    this.error = '';
    this.notice = '';
    this.followLatest = true;
    try {
      const result = await AdminAssistantPageExecutionService.executeActions(this.api, { actions: this.lastActions, selectedActionIndexes: this.selectedActionIndexes, activeSessionId: this.activeSessionId, activeBatchId: this.activeBatchId, dryRun });
      const summary = AdminAssistantPageExecutionService.summarizeExecution(result, dryRun);
      if (summary.batchId) this.batchExecutionSummaries = { ...this.batchExecutionSummaries, [summary.batchId]: { ok: summary.ok, unchanged: summary.unchanged, failed: summary.failed } };
      const prev = this.messages;
      const fallbackIndex = summary.batchId ? -1 : [...prev].map((entry, index) => ({ entry, index })).reverse().find((entry) => entry.entry.actionBatch && entry.entry.actionBatch.state !== BatchState.STALE)?.index ?? -1;
      const nextMessages = prev.map((entry, index) => {
        const isCurrentBatch = summary.batchId ? String(entry.actionBatch?.id || '').trim() === summary.batchId : index === fallbackIndex;
        if (!isCurrentBatch) return entry;
        const nextUi = dryRun
          ? entry.ui ? { ...entry.ui, nextStep: NextStep.APPLY, workflowState: WorkflowState.PREVIEWED, primaryAction: PrimaryAction.APPLY, userSummary: 'Preview complete. Review and apply when ready.', summaryMode: entry.ui.summaryMode ?? ResponseVerbosity.CONCISE } : entry.ui
          : entry.ui ? { ...entry.ui, requiresApproval: false, canContinue: false, nextStep: NextStep.NONE, workflowState: WorkflowState.APPLIED, primaryAction: PrimaryAction.NONE, userSummary: 'Changes applied.', summaryMode: entry.ui.summaryMode ?? ResponseVerbosity.CONCISE } : entry.ui;
        return { ...entry, actionBatch: entry.actionBatch ? { ...entry.actionBatch, state: summary.batchState } : { id: summary.batchId || `batch-${Date.now()}`, state: summary.batchState, createdAt: Date.now() }, ui: nextUi, plan: !dryRun && entry.plan ? { ...entry.plan, status: AssistantPlanStatus.COMPLETED } : entry.plan };
      });
      this.messages = [...nextMessages, { role: AssistantRole.SYSTEM, content: summary.summaryText, execution: result, actionBatch: summary.batchId ? { id: summary.batchId, state: summary.batchState, createdAt: Date.now() } : nextMessages.slice().reverse().find((entry) => entry.actionBatch)?.actionBatch || undefined }];
      if (!dryRun) this.selectedActionIndexes = [];
      this.notice = dryRun ? 'Previewed selected changes.' : 'Applied selected changes.';
      void this.refreshHistoryIfServer();
    } catch (e: any) {
      this.error = String(e?.message || 'Execution failed');
    } finally {
      this.executing = false;
    }
  }

  @bound
  onComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void this.sendPrompt();
    }
  }

  @bound
  onQuickFix(): void {
    this.error = '';
    this.chatMode = ChatMode.AGENT;
    this.notice = 'Quick Fix enabled.';
    requestAnimationFrame(() => this.textareaRef.current?.focus());
  }

  @bound openFilePicker(): void { this.fileInputRef.current?.click(); }
  @bound removeAttachment(indexToRemove: number): void { this.attachments = this.attachments.filter((_, index) => index !== indexToRemove); }

  @bound
  async onFilesSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    this.error = '';
    this.notice = '';
    this.uploadingAttachments = true;
    try {
      const uploadedItems = await AdminAssistantPageExecutionService.uploadAttachments(this.api, files);
      this.attachments = [...this.attachments, ...uploadedItems];
      this.notice = `${uploadedItems.length} asset${uploadedItems.length > 1 ? 's' : ''} uploaded.`;
    } catch (e: any) {
      this.error = String(e?.message || 'Failed to upload attachment.');
    } finally {
      this.uploadingAttachments = false;
      if (event.target) event.target.value = '';
    }
  }

  @bound
  toggleTool(toolName: string): void {
    const value = String(toolName || '').trim();
    if (!value) return;
    this.selectedTools = this.selectedTools.includes(value) ? this.selectedTools.filter((item) => item !== value) : [...this.selectedTools, value];
  }

  @bound toggleActionIndex(actionIndex: number): void { this.selectedActionIndexes = this.selectedActionIndexes.includes(actionIndex) ? this.selectedActionIndexes.filter((item) => item !== actionIndex) : [...this.selectedActionIndexes, actionIndex]; }
  @bound selectAllActions(): void { this.selectedActionIndexes = this.lastActions.map((_, index) => index); }
  @bound clearSelectedActions(): void { this.selectedActionIndexes = []; }
  @bound runPreview(): Promise<void> { return this.runActions(true); }
  @bound runApply(): Promise<void> { return this.runActions(false); }
  @bound clearNotice(): void { this.notice = ''; }
  @bound clearError(): void { this.error = ''; }

  // ==================================================================================================
  //  Lifecycle — the former *-effects components folded into mount/watch/unmount.
  // ==================================================================================================
  componentDidMount(): void {
    this.onUnmount(() => {
      this.cancelled = true;
      this.pinCleanup?.();
      this.layoutPinCleanup?.();
      this.historyPinCleanup?.();
      this.toolsMenuCleanup?.();
      this.mobileEscCleanup?.();
      if (this.providerModelsTimer !== undefined) window.clearTimeout(this.providerModelsTimer);
    });

    // Layout effects
    this.autoResizeTextArea();
    this.syncViewport();
    this.listen(window, 'resize', this.syncViewport);
    this.attachScrollListener();
    this.runPinEffect();
    this.runLayoutPinEffect();
    this.runHistoryPinEffect();
    this.applyToolsMenuEffect();
    this.applyMobileEscapeEffect();

    // Data effects
    void this.loadIntegration();
    void this.loadTools();
    void this.loadSkills();

    // History effects
    this.applyThemeMode();
    void this.hydrateHistory();
    this.persistHistory();
    this.loadUiPrefs();
    this.writeUiPrefs();
  }

  // --- layout watchers ---
  @watch('prompt')
  protected onPromptChanged(): void {
    this.autoResizeTextArea();
  }

  @watch('loading')
  protected onLoadingChanged(loading: boolean): void {
    if (loading) {
      this.followLatest = true;
      this.loadingPhaseIndex = 0;
    } else {
      this.loadingPhaseIndex = 0;
    }
    if (this.chatMode !== ChatMode.AUTO && loading) this.loadingPhaseIndex = 0;
    this.runPinEffect();
    this.runLayoutPinEffect();
  }

  @watch('chatMode')
  protected onChatModeChanged(): void {
    if (this.chatMode !== ChatMode.AUTO && this.loading) this.loadingPhaseIndex = 0;
    this.writeUiPrefs();
  }

  @watch('messages')
  protected onMessagesChanged(): void {
    this.runPinEffect();
    this.runLayoutPinEffect();
    this.runHistoryPinEffect();
    this.syncLocalHistory();
  }

  @watch('messages')
  protected onActiveBatchChanged(): void {
    const nextIndexes = this.activeBatchId ? this.lastActions.map((_, index) => index) : [];
    const prev = this.selectedActionIndexes;
    if (prev.length === nextIndexes.length && prev.every((value, index) => value === nextIndexes[index])) return;
    this.selectedActionIndexes = nextIndexes;
  }

  @watch('showTools')
  protected onShowToolsChanged(): void {
    this.applyToolsMenuEffect();
  }

  @watch('showTechnicalDetails')
  protected onShowTechnicalDetailsChanged(): void {
    if (!this.showTechnicalDetails && this.showTools) this.showTools = false;
  }

  @watch('layoutState')
  protected onLayoutStateChanged(): void {
    this.applyMobileEscapeEffect();
    this.runLayoutPinEffect();
    this.writeUiPrefs();
  }

  @watch('historyHydrated')
  protected onHistoryHydratedChanged(): void {
    this.runHistoryPinEffect();
    this.persistHistory();
  }

  @watch('activeSessionId')
  protected onActiveSessionChanged(): void {
    this.runHistoryPinEffect();
    this.persistHistory();
  }

  @watch('themeMode')
  protected onThemeModeChanged(): void {
    this.applyThemeMode();
  }

  @watch('historySessions')
  protected onHistorySessionsChanged(): void {
    this.persistHistory();
  }

  @watch('historySource')
  protected onHistorySourceChanged(): void {
    this.persistHistory();
    this.syncLocalHistory();
  }

  @watch('checkingIntegration')
  protected onCheckingIntegrationChanged(): void {
    this.loadUiPrefs();
    this.scheduleProviderModels();
  }

  @watch('uiPrefsHydrated')
  protected onUiPrefsHydratedChanged(): void {
    this.scheduleProviderModels();
  }

  @watch('apiKey')
  protected onApiKeyChanged(): void {
    this.scheduleProviderModels();
  }

  @watch('hasSavedSecret')
  protected onHasSavedSecretChanged(): void {
    this.scheduleProviderModels();
  }

  @watch('provider')
  protected onProviderChanged(): void {
    this.scheduleProviderModels();
    this.writeUiPrefs();
    this.normalizeBaseUrl();
    this.syncLocalHistory();
  }

  @watch('model')
  protected onModelChanged(): void {
    this.scheduleProviderModels();
    this.writeUiPrefs();
    this.syncLocalHistory();
  }

  @watch('baseUrl')
  protected onBaseUrlChanged(): void {
    this.scheduleProviderModels();
    this.writeUiPrefs();
    this.normalizeBaseUrl();
  }

  @watch('skillId')
  protected onSkillIdChanged(): void {
    this.writeUiPrefs();
    this.syncLocalHistory();
  }

  @watch('sandboxMode')
  protected onSandboxModeChanged(): void {
    this.writeUiPrefs();
    this.syncLocalHistory();
  }

  // --- layout effect implementations ---
  private attachScrollListener(): void {
    const viewport = this.viewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      this.followLatest = distanceToBottom <= this.followDistanceThreshold;
    };
    onScroll();
    this.listen(viewport, 'scroll', onScroll, { passive: true });
  }

  private runPinEffect(): void {
    this.pinCleanup?.();
    this.pinCleanup = undefined;
    if (this.messages.length <= 0) return;
    this.pinCleanup = this.pinToBottom(this.messages.length > 1 ? 'smooth' : 'auto');
  }

  private runLayoutPinEffect(): void {
    this.layoutPinCleanup?.();
    this.layoutPinCleanup = undefined;
    if (!this.hasConversation) return;
    this.layoutPinCleanup = this.pinToBottom('auto');
  }

  private runHistoryPinEffect(): void {
    this.historyPinCleanup?.();
    this.historyPinCleanup = undefined;
    if (!this.historyHydrated || !this.hasConversation) return;
    this.historyPinCleanup = this.pinToBottom('auto');
  }

  private applyToolsMenuEffect(): void {
    this.toolsMenuCleanup?.();
    this.toolsMenuCleanup = undefined;
    if (!this.showTools) { this.toolsMenuStyle = null; return; }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = !!(this.toolsMenuRef.current && this.toolsMenuRef.current.contains(target));
      const insideMenu = !!(this.toolsDropdownRef.current && this.toolsDropdownRef.current.contains(target));
      if (!insideTrigger && !insideMenu) this.showTools = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.showTools = false;
    };
    this.updateToolsMenuPosition();
    const rafId = window.requestAnimationFrame(this.updateToolsMenuPosition);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', this.updateToolsMenuPosition);
    window.addEventListener('scroll', this.updateToolsMenuPosition, true);
    this.toolsMenuCleanup = () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', this.updateToolsMenuPosition);
      window.removeEventListener('scroll', this.updateToolsMenuPosition, true);
    };
  }

  private applyMobileEscapeEffect(): void {
    this.mobileEscCleanup?.();
    this.mobileEscCleanup = undefined;
    if (this.layoutState.viewport !== AssistantViewport.MOBILE) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
    };
    window.addEventListener('keydown', onKeyDown);
    this.mobileEscCleanup = () => window.removeEventListener('keydown', onKeyDown);
  }

  // --- data effect implementations ---
  private async loadIntegration(): Promise<void> {
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

  private scheduleProviderModels(): void {
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

  private async loadTools(): Promise<void> {
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

  private async loadSkills(): Promise<void> {
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

  // --- history effect implementations ---
  private applyThemeMode(): void {
    if (!Platform.isBrowser) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(this.themeMode.value);
    if (Platform.isBrowser) AdminAssistantPageController.assistantBrowserState.writeThemePreference(this.themeMode.value);
  }

  private async hydrateHistory(): Promise<void> {
    if (this.historyHydratedInternal || this.historyHydrationInFlight || this.historyHydrated) return;
    this.historyHydrationInFlight = true;
    const savedActive = Platform.isBrowser ? AdminAssistantPageController.assistantBrowserState.readActiveSessionId() : '';
    let serverLoaded = false;
    let localSessions: ReturnType<typeof AdminAssistantPageSessionService.loadHistoryFromLocal> = [];
    try {
      this.historyLoading = true;
      const sessions = await AdminAssistantPageSessionService.refreshServerHistory(this.api, this.provider);
      if (this.cancelled) { this.historyHydrationInFlight = false; return; }
      this.historySessions = sessions;
      this.historySource = ModelLocation.SERVER;
      serverLoaded = true;
    } catch {
      localSessions = AdminAssistantPageSessionService.loadHistoryFromLocal(AdminAssistantPageController.assistantBrowserState, this.provider);
      if (this.cancelled) { this.historyHydrationInFlight = false; return; }
      this.historySessions = localSessions;
      this.historySource = ModelLocation.LOCAL;
    } finally {
      if (!this.cancelled) this.historyLoading = false;
    }

    if (savedActive) {
      try {
        if (serverLoaded) {
          const detailed = await AdminAssistantPageSessionService.fetchSession(this.api, savedActive, this.provider);
          if (!this.cancelled && detailed) {
            this.historySessions = [detailed, ...this.historySessions.filter((item) => item.id !== detailed.id)];
            this.activeSessionId = detailed.id;
            this.messages = detailed.messages.length ? detailed.messages : AdminAssistantPageUtils.createReadyConversation();
            this.provider = detailed.provider || 'openai';
            if (detailed.model) this.model = detailed.model;
            if (detailed.skillId) this.skillId = detailed.skillId;
            this.chatMode = detailed.chatMode || ChatMode.AUTO;
            this.sandboxMode = detailed.sandboxMode !== false;
          } else if (!this.cancelled) {
            AdminAssistantPageController.assistantBrowserState.writeActiveSessionId('');
            this.activeSessionId = '';
          }
        } else {
          const active = localSessions.find((item) => item.id === savedActive);
          if (active) {
            this.activeSessionId = active.id;
            this.messages = active.messages;
            this.provider = active.provider || 'openai';
            if (active.model) this.model = active.model;
            if (active.skillId) this.skillId = active.skillId;
            this.chatMode = active.chatMode || ChatMode.AUTO;
            this.sandboxMode = active.sandboxMode !== false;
          } else {
            AdminAssistantPageController.assistantBrowserState.writeActiveSessionId('');
            this.activeSessionId = '';
          }
        }
      } catch {
        if (!this.cancelled) {
          AdminAssistantPageController.assistantBrowserState.writeActiveSessionId('');
          this.activeSessionId = '';
        }
      }
    }

    this.historyHydrationInFlight = false;
    if (!this.cancelled) {
      this.historyHydratedInternal = true;
      this.historyHydrated = true;
    }
  }

  private persistHistory(): void {
    if (!Platform.isBrowser || !this.historyHydrated) return;
    try {
      if (this.historySource === ModelLocation.LOCAL) AdminAssistantPageController.assistantBrowserState.writeHistoryEntries(this.historySessions.slice(0, 40));
      AdminAssistantPageController.assistantBrowserState.writeActiveSessionId(this.activeSessionId);
    } catch {
      return;
    }
  }

  private loadUiPrefs(): void {
    if (this.checkingIntegration || this.prefsLoaded || !Platform.isBrowser) return;
    this.prefsLoaded = true;
    try {
      const parsed = AdminAssistantPageController.assistantBrowserState.readUiPreferences();
      if (!parsed.provider && !parsed.model && !parsed.skillId && !parsed.baseUrl && !parsed.chatMode && parsed.sandboxMode === null && parsed.leftSidebarOpen === null && parsed.rightSidebarOpen === null) {
        this.uiPrefsHydrated = true;
        return;
      }
      if (!this.integrationConfigured) {
        const provider = parsed.provider || this.provider;
        const baseUrl = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(provider, AdminAssistantPageController.assistantBrowserState.readProviderBaseUrl(provider));
        if (parsed.provider && AssistantConstants.PROVIDER_OPTIONS.some((item) => item.value === parsed.provider)) {
          this.provider = parsed.provider;
        }
        if (parsed.model) this.model = parsed.model;
        if (baseUrl) this.baseUrl = baseUrl;
        else if (provider === 'ollama') this.baseUrl = AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL;
      }
      if (parsed.skillId) this.skillId = parsed.skillId;
      if (parsed.chatMode) this.chatMode = ChatMode.resolve(parsed.chatMode);
      if (typeof parsed.sandboxMode === 'boolean') this.sandboxMode = parsed.sandboxMode;
      if (parsed.leftSidebarOpen !== null || parsed.rightSidebarOpen !== null) {
        this.layoutState = {
          ...this.layoutState,
          leftOpen: parsed.leftSidebarOpen !== null ? parsed.leftSidebarOpen : this.layoutState.leftOpen,
          rightOpen: parsed.rightSidebarOpen !== null ? parsed.rightSidebarOpen : this.layoutState.rightOpen,
        };
      }
    } catch {
      return;
    } finally {
      this.uiPrefsHydrated = true;
    }
  }

  private writeUiPrefs(): void {
    if (!Platform.isBrowser) return;
    try {
      const persistedPreferences = AdminAssistantPageController.assistantBrowserState.readUiPreferences();
      const persistedBaseUrls = { ...persistedPreferences.baseUrls };
      const normalizedProvider = String(this.provider || '').trim().toLowerCase();
      const normalizedBaseUrl = String(this.baseUrl || '').trim();
      if (normalizedProvider) {
        if (normalizedBaseUrl) persistedBaseUrls[normalizedProvider] = normalizedBaseUrl;
        else delete persistedBaseUrls[normalizedProvider];
      }
      AdminAssistantPageController.assistantBrowserState.writeUiPreferences({
        provider: this.provider,
        model: this.model,
        skillId: this.skillId,
        baseUrl: normalizedBaseUrl,
        baseUrls: persistedBaseUrls,
        chatMode: this.chatMode.value,
        sandboxMode: this.sandboxMode,
        leftSidebarOpen: this.layoutState.leftOpen,
        rightSidebarOpen: this.layoutState.rightOpen,
      });
    } catch {
      return;
    }
  }

  private normalizeBaseUrl(): void {
    const normalizedProvider = String(this.provider || '').trim().toLowerCase();
    const sanitized = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(normalizedProvider, this.baseUrl);
    if (sanitized === this.baseUrl) return;
    this.baseUrl = normalizedProvider === 'ollama' ? AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL : sanitized;
  }

  private syncLocalHistory(): void {
    if (this.historySource !== ModelLocation.LOCAL) return;
    const normalizedMessages = this.messages.filter((entry) => entry.role !== AssistantRole.SYSTEM || entry.content !== AdminAssistantPageUtils.createReadyMessage().content);
    if (!normalizedMessages.length) return;
    const sessionId = this.activeSessionId || AdminAssistantPageUtils.createSessionId();
    if (!this.activeSessionId) this.activeSessionId = sessionId;
    const session = AdminAssistantPageSessionService.createLocalSession(sessionId, this.messages, this.provider, this.model, this.skillId, this.chatMode, this.sandboxMode);
    this.historySessions = [session, ...this.historySessions.filter((item) => item.id !== sessionId)].slice(0, 40);
  }

  render(): ReactNode {
    return <AdminAssistantPageView model={this} />;
  }
}
