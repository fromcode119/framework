import { ExecutionKind } from '@ai/enums/assistant-execution-kind.enum';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import { AssistantIntentUtils } from '@ai/assistant-intent-utils';
import { AssistantSurfaceUtils } from '@ai/assistant-surface-utils';
import { AssistantTextUtils } from '@ai/assistant-text-utils';
import { AdminAssistantMessageService } from '@ai/admin-assistant-page/admin-assistant-message-service';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import type { IAssistantAction } from '@ai/interfaces/assistant-action.interface';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IUploadedAttachment } from '@ai/interfaces/uploaded-attachment.interface';

export class AdminAssistantPageExecutionService {
  static shouldAutoApprove(content: string, lastActions: IAssistantAction[], selectedActionCount: number, executing: boolean): boolean {
    return AssistantIntentUtils.isApprovalPrompt(content) && lastActions.length > 0 && selectedActionCount > 0 && !executing;
  }

  static buildChatRequest(params: {
    content: string;
    messages: IAssistantMessage[];
    attachments: IUploadedAttachment[];
    activeSessionId: string;
    provider: string;
    model: string;
    baseUrl: string;
    skillId: string;
    availableTools: Array<{ tool: string }>;
    selectedTools: string[];
    chatMode: ChatMode;
  }): {
    sessionId: string;
    requestedAgentMode: ContextLevel;
    requestBody: Record<string, any>;
    userMessage: IAssistantMessage;
  } {
    const currentAttachments = params.attachments.map((item) => ({ ...item }));
    const attachmentContext = AssistantTextUtils.serializeAttachmentsForModel(currentAttachments);
    const contentForModel = attachmentContext ? `${params.content}\n\n${attachmentContext}` : params.content;
    const sessionId = String(params.activeSessionId || '').trim() || AdminAssistantPageUtils.createSessionId();
    const history = params.messages
      .filter((entry) => entry.role !== AssistantRole.SYSTEM)
      .map((entry) => {
        if (entry.role === AssistantRole.USER && Array.isArray(entry.attachments) && entry.attachments.length > 0) {
          const serialized = AssistantTextUtils.serializeAttachmentsForModel(entry.attachments);
          return {
            role: entry.role,
            content: serialized ? `${entry.content}\n\n${serialized}` : entry.content,
          };
        }
        return { role: entry.role, content: entry.content };
      });
    const lastAssistantMessage = [...params.messages].reverse().find((entry) => entry.role === AssistantRole.ASSISTANT);
    const pendingCheckpoint =
      lastAssistantMessage?.checkpoint && lastAssistantMessage?.ui?.needsClarification
        ? lastAssistantMessage.checkpoint
        : undefined;
    const requestedAgentMode =
      params.chatMode === ChatMode.PLAN || params.chatMode === ChatMode.AGENT
        ? ContextLevel.ADVANCED
        : AssistantIntentUtils.hasPlanningIntent(contentForModel)
          ? ContextLevel.ADVANCED
          : ContextLevel.BASIC;
    const requestedMaxIterations = requestedAgentMode === ContextLevel.ADVANCED ? (params.chatMode === ChatMode.AGENT ? 12 : 8) : 1;
    const requestedMaxDurationMs = requestedAgentMode === ContextLevel.ADVANCED ? (params.chatMode === ChatMode.AGENT ? 35000 : 26000) : 12000;

    return {
      sessionId,
      requestedAgentMode,
      userMessage: {
        role: AssistantRole.USER,
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

  static buildAssistantMessage(result: any, model: string, provider: string): IAssistantMessage {
    return AdminAssistantMessageService.buildAssistantMessageFromResult(result, model, provider);
  }

  static appendAssistantMessage(messages: IAssistantMessage[], assistantMessage: IAssistantMessage): IAssistantMessage[] {
    return AdminAssistantMessageService.appendAssistantMessage(messages, assistantMessage);
  }

  static async executeActions(
    api: any,
    params: {
      actions: IAssistantAction[];
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
    batchState: BatchState;
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
    const ok = serverSummary?.ok ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === ExecutionKind.OK).length;
    const unchanged =
      serverSummary?.unchanged ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === ExecutionKind.SKIPPED).length;
    const failed = serverSummary?.failed ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === ExecutionKind.FAILED).length;
    const batchId = String(result?.executedBatchId || '').trim();
    const batchState =
      BatchState.resolve(String(result?.batchState || (dryRun ? BatchState.PREVIEWED.value : BatchState.APPLIED.value)).trim().toLowerCase()) === BatchState.PREVIEWED
        ? BatchState.PREVIEWED
        : BatchState.APPLIED;

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

  static async uploadAttachments(api: any, files: File[]): Promise<IUploadedAttachment[]> {
    const uploadedItems: IUploadedAttachment[] = [];
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
