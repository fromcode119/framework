import { AssistantConstants } from '../admin-assistant-core';
import { AssistantIntentUtils } from '../assistant-intent-utils';
import { AssistantSurfaceUtils } from '../assistant-surface-utils';
import { AssistantTextUtils } from '../assistant-text-utils';
import { AdminAssistantMessageService } from './admin-assistant-message-service';
import { AdminAssistantPageUtils } from './admin-assistant-page-utils';
import type { AssistantAction, AssistantMessage, UploadedAttachment } from '../admin-assistant-core';

export class AdminAssistantPageExecutionService {
  static shouldAutoApprove(content: string, lastActions: AssistantAction[], selectedActionCount: number, executing: boolean): boolean {
    return AssistantIntentUtils.isApprovalPrompt(content) && lastActions.length > 0 && selectedActionCount > 0 && !executing;
  }

  static buildChatRequest(params: {
    content: string;
    messages: AssistantMessage[];
    attachments: UploadedAttachment[];
    activeSessionId: string;
    provider: string;
    model: string;
    baseUrl: string;
    skillId: string;
    availableTools: Array<{ tool: string }>;
    selectedTools: string[];
    chatMode: 'auto' | 'plan' | 'agent';
  }): {
    sessionId: string;
    requestedAgentMode: 'basic' | 'advanced';
    requestBody: Record<string, any>;
    userMessage: AssistantMessage;
  } {
    const currentAttachments = params.attachments.map((item) => ({ ...item }));
    const attachmentContext = AssistantTextUtils.serializeAttachmentsForModel(currentAttachments);
    const contentForModel = attachmentContext ? `${params.content}\n\n${attachmentContext}` : params.content;
    const sessionId = String(params.activeSessionId || '').trim() || AdminAssistantPageUtils.createSessionId();
    const history = params.messages
      .filter((entry) => entry.role !== 'system')
      .map((entry) => {
        if (entry.role === 'user' && Array.isArray(entry.attachments) && entry.attachments.length > 0) {
          const serialized = AssistantTextUtils.serializeAttachmentsForModel(entry.attachments);
          return {
            role: entry.role,
            content: serialized ? `${entry.content}\n\n${serialized}` : entry.content,
          };
        }
        return { role: entry.role, content: entry.content };
      });
    const lastAssistantMessage = [...params.messages].reverse().find((entry) => entry.role === 'assistant');
    const pendingCheckpoint =
      lastAssistantMessage?.checkpoint && lastAssistantMessage?.ui?.needsClarification
        ? lastAssistantMessage.checkpoint
        : undefined;
    const requestedAgentMode =
      params.chatMode === 'plan' || params.chatMode === 'agent'
        ? 'advanced'
        : AssistantIntentUtils.hasPlanningIntent(contentForModel)
          ? 'advanced'
          : 'basic';
    const requestedMaxIterations = requestedAgentMode === 'advanced' ? (params.chatMode === 'agent' ? 12 : 8) : 1;
    const requestedMaxDurationMs = requestedAgentMode === 'advanced' ? (params.chatMode === 'agent' ? 35000 : 26000) : 12000;

    return {
      sessionId,
      requestedAgentMode,
      userMessage: {
        role: 'user',
        content: params.content,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      },
      requestBody: {
        message: contentForModel,
        history,
        sessionId,
        provider: params.provider,
        config: {
          model: String(params.model || '').trim() || undefined,
          baseUrl: String(params.baseUrl || '').trim() || undefined,
        },
        tools: params.availableTools.length > 0 ? params.selectedTools : undefined,
        skillId: params.skillId,
        agentMode: requestedAgentMode,
        maxIterations: requestedMaxIterations,
        maxDurationMs: requestedMaxDurationMs,
        continueFrom: !!pendingCheckpoint,
        checkpoint: pendingCheckpoint,
      },
    };
  }

  static async requestAssistantResponse(api: any, requestBody: Record<string, any>): Promise<any> {
    return api.post(AssistantConstants.ENDPOINTS.CHAT, requestBody);
  }

  static buildAssistantMessage(result: any, model: string, provider: string): AssistantMessage {
    return AdminAssistantMessageService.buildAssistantMessageFromResult(result, model, provider);
  }

  static appendAssistantMessage(messages: AssistantMessage[], assistantMessage: AssistantMessage): AssistantMessage[] {
    return AdminAssistantMessageService.appendAssistantMessage(messages, assistantMessage);
  }

  static async executeActions(
    api: any,
    params: {
      actions: AssistantAction[];
      selectedActionIndexes: number[];
      activeSessionId: string;
      activeBatchId: string;
      dryRun: boolean;
    },
  ): Promise<any> {
    const actionsToRun =
      params.selectedActionIndexes.length > 0
        ? params.selectedActionIndexes
            .filter((index) => index >= 0 && index < params.actions.length)
            .map((index) => params.actions[index])
        : [];
    if (!actionsToRun.length) {
      throw new Error('Select at least one staged action to approve.');
    }

    return api.post(AssistantConstants.ENDPOINTS.EXECUTE, {
      actions: actionsToRun,
      dryRun: params.dryRun,
      sessionId: params.activeSessionId || undefined,
      batchId: params.activeBatchId || undefined,
    });
  }

  static summarizeExecution(result: any, dryRun: boolean): {
    batchId: string;
    batchState: 'previewed' | 'applied';
    ok: number;
    unchanged: number;
    failed: number;
    summaryText: string;
  } {
    const executionItems = Array.isArray(result?.results) ? result.results : [];
    const serverSummary =
      result?.executionSummary && typeof result.executionSummary === 'object'
        ? {
            ok: Number(result.executionSummary.ok || 0) || 0,
            unchanged: Number(result.executionSummary.unchanged || 0) || 0,
            failed: Number(result.executionSummary.failed || 0) || 0,
          }
        : null;
    const ok = serverSummary?.ok ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'ok').length;
    const unchanged =
      serverSummary?.unchanged ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'skipped').length;
    const failed = serverSummary?.failed ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'failed').length;
    const batchId = String(result?.executedBatchId || '').trim();
    const batchState =
      String(result?.batchState || (dryRun ? 'previewed' : 'applied')).trim().toLowerCase() === 'previewed'
        ? ('previewed' as const)
        : ('applied' as const);

    return {
      batchId,
      batchState,
      ok,
      unchanged,
      failed,
      summaryText: dryRun
        ? `Preview completed: ${ok} ready, ${unchanged} unchanged, ${failed} failed.`
        : `Execution completed: ${ok} applied, ${unchanged} unchanged, ${failed} failed.`,
    };
  }

  static async uploadAttachments(api: any, files: File[]): Promise<UploadedAttachment[]> {
    const uploadedItems: UploadedAttachment[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post('/media/upload', form);
      uploadedItems.push({
        id: response?.id !== undefined ? String(response.id) : undefined,
        name: String(response?.originalName || response?.filename || file.name),
        url: response?.url ? String(response.url) : undefined,
        path: response?.path ? String(response.path) : undefined,
        mimeType: response?.mimeType ? String(response.mimeType) : file.type,
        size: Number(response?.fileSize || file.size || 0) || undefined,
        width: Number(response?.width || 0) || undefined,
        height: Number(response?.height || 0) || undefined,
      });
    }
    return uploadedItems;
  }
}
