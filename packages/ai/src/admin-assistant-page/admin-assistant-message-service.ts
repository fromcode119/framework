import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import { PrimaryAction } from '@ai/enums/primary-action.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { WorkflowState } from '@ai/enums/workflow-state.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { AssistantFormatUtils } from '@ai/assistant-format-utils';
import { AssistantTextUtils } from '@ai/assistant-text-utils';
import type { IAssistantAction } from '@ai/interfaces/assistant-action.interface';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IForgeHistorySession } from '@ai/interfaces/forge-history-session.interface';
import { AssistantPlanStatus } from '@ai/admin-assistant-runtime/enums/assistant-plan-status.enum';

export class AdminAssistantMessageService {
  static getActiveBatchEntry(messages: IAssistantMessage[]) {
    const candidates = messages
      .map((entry, index) => {
        const actions = Array.isArray(entry.actions) ? entry.actions : [];
        if (!actions.length || !entry.actionBatch) return null;
        return {
          index,
          actions,
          actionBatch: entry.actionBatch,
          ui: entry.ui,
        };
      })
      .filter(Boolean) as Array<{
        index: number;
        actions: IAssistantAction[];
        actionBatch: NonNullable<IAssistantMessage['actionBatch']>;
        ui?: IAssistantMessage['ui'];
      }>;

    if (!candidates.length) return null;
    const source = candidates.some((item) => item.actionBatch.state !== BatchState.STALE)
      ? candidates.filter((item) => item.actionBatch.state !== BatchState.STALE)
      : candidates;

    return source.sort((a, b) => {
      const byTime = Number(b.actionBatch.createdAt || 0) - Number(a.actionBatch.createdAt || 0);
      return byTime !== 0 ? byTime : b.index - a.index;
    })[0];
  }

  static buildAssistantMessageFromResult(result: any, model: string, provider: string): IAssistantMessage {
    const plan = result?.plan && typeof result.plan === 'object' ? result.plan : undefined;
    const ui = result?.ui && typeof result.ui === 'object' ? result.ui : undefined;
    const actions = Array.isArray(result?.actions) ? result.actions : [];
    const actionBatch =
      result?.actionBatch && typeof result.actionBatch === 'object'
        ? {
            id: String(result.actionBatch.id || '').trim() || `batch-${Date.now()}`,
            state: BatchState.resolve(String(result.actionBatch.state || BatchState.STAGED.value).trim().toLowerCase()),
            createdAt: Number(result.actionBatch.createdAt || Date.now()) || Date.now(),
          }
        : actions.length > 0
          ? { id: `batch-${Date.now()}`, state: BatchState.STAGED, createdAt: Date.now() }
          : undefined;
    const reasoningReport =
      typeof result?.reasoningReport === 'string' && result.reasoningReport.trim()
        ? result.reasoningReport.trim()
        : undefined;
    const planStatus = String((plan as any)?.status || '').trim().toLowerCase();
    const suppressPrimaryText =
      !!plan &&
      (actions.length > 0 ||
        ui?.canContinue ||
        ui?.requiresApproval ||
        AssistantPlanStatus.resolve(planStatus).showsPlanCard);
    const normalizedMessage = AssistantTextUtils.normalizeAssistantBodyText(String(result?.message || '').trim());
    const fallbackMessage =
      suppressPrimaryText ? '' : normalizedMessage || 'I finished this step. Tell me what you want to do next.';

    return {
      role: AssistantRole.ASSISTANT,
      content: fallbackMessage,
      actions,
      actionBatch,
      traces: Array.isArray(result?.traces)
        ? result.traces.map((trace: any, index: number) => ({
            iteration: Number(trace?.iteration || index + 1),
            message: trace?.message ? String(trace.message) : undefined,
            toolCalls: AssistantFormatUtils.sanitizeTraceToolCalls(trace?.toolCalls),
          }))
        : undefined,
      plan,
      ui,
      skill: result?.skill && typeof result.skill === 'object' ? result.skill : undefined,
      sessionId: result?.sessionId ? String(result.sessionId) : undefined,
      checkpoint: result?.checkpoint && typeof result.checkpoint === 'object' ? result.checkpoint : undefined,
      done: result?.done === true,
      iterations: Number.isFinite(Number(result?.iterations)) ? Number(result.iterations) : undefined,
      loopCapReached: result?.loopCapReached === true,
      model: result?.model ? String(result.model) : model,
      provider: result?.provider ? String(result.provider) : provider,
      reasoningReport,
    };
  }

  static appendAssistantMessage(messages: IAssistantMessage[], assistantMessage: IAssistantMessage): IAssistantMessage[] {
    const hasFreshBatch =
      Array.isArray(assistantMessage.actions) &&
      assistantMessage.actions.length > 0 &&
      !!assistantMessage.actionBatch;
    const normalizedPrev = hasFreshBatch
      ? messages.map((entry) => {
          if (!entry.actionBatch) return entry;
          if (entry.actionBatch.state !== BatchState.STAGED && entry.actionBatch.state !== BatchState.PREVIEWED) return entry;
          return {
            ...entry,
            actionBatch: { ...entry.actionBatch, state: BatchState.STALE },
            ui: entry.ui
              ? {
                  ...entry.ui,
                  nextStep: NextStep.NONE,
                  workflowState: WorkflowState.STALE,
                  primaryAction: PrimaryAction.NONE,
                  userSummary: 'This batch is stale. Request a fresh batch.',
                  summaryMode: entry.ui.summaryMode ?? ResponseVerbosity.CONCISE,
                }
              : entry.ui,
          };
        })
      : messages;
    return [...normalizedPrev, assistantMessage];
  }

  static mapHistorySession(item: any, fallbackProvider: string): IForgeHistorySession | null {
    const id = String(item?.id || '').trim();
    if (!id) return null;
    const providerValue = String(item?.provider || fallbackProvider || 'openai').trim().toLowerCase() || 'openai';
    const modeRaw = String(item?.chatMode || '').trim().toLowerCase();
    const mappedMode: ChatMode =
      modeRaw === 'plan' || modeRaw === 'agent'
        ? ChatMode.resolve(modeRaw)
        : String(item?.agentMode || '').trim().toLowerCase() === 'advanced'
          ? ChatMode.PLAN
          : ChatMode.AUTO;
    const messages = Array.isArray(item?.messages)
      ? item.messages
          .map((entry: any) => ({
            role:
              entry?.role === 'assistant' || entry?.role === 'system' || entry?.role === 'user'
                ? entry.role
                : 'assistant',
            content: String(entry?.content || '').trim(),
          }))
          .filter((entry: IAssistantMessage) => !!entry.content)
      : [];

    return {
      id,
      title: String(item?.title || AssistantTextUtils.summarizeSessionTitle(messages)).trim() || 'Untitled session',
      updatedAt: Number(item?.updatedAt || Date.now()) || Date.now(),
      provider: providerValue,
      model: String(item?.model || '').trim(),
      skillId: String(item?.skillId || 'general').trim().toLowerCase() || 'general',
      chatMode: mappedMode,
      sandboxMode: item?.sandboxMode !== false,
      messages,
      messageCount: Number(item?.messageCount || messages.length || 0),
    };
  }
}
