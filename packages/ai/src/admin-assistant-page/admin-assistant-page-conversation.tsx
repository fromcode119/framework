import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { PrimaryAction } from '@ai/enums/primary-action.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { WorkflowState } from '@ai/enums/workflow-state.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AssistantProviderUtils } from '@ai/assistant-provider-utils';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import { AdminAssistantPageExecutionService } from '@ai/admin-assistant-page/admin-assistant-page-execution-service';
import { AssistantPlanStatus } from '@ai/admin-assistant-runtime/enums/assistant-plan-status.enum';
import { AdminAssistantPageSessions } from '@ai/admin-assistant-page/admin-assistant-page-sessions';

/**
 * Sending a prompt, and applying what comes back.
 *
 * Actions are staged, not run: the assistant answers with a batch the operator previews and then
 * applies, and `dryRun` is the difference between the two. A batch carries its own id so a reply that
 * arrives after the operator has moved on updates the batch it belongs to rather than the newest one.
 */
export class AdminAssistantPageConversation extends AdminAssistantPageSessions {

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
}
