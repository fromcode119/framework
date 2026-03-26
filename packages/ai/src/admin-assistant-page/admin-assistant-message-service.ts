import { AssistantFormatUtils } from '../assistant-format-utils';
import { AssistantTextUtils } from '../assistant-text-utils';
import type { AssistantAction, AssistantMessage, ForgeHistorySession } from '../admin-assistant-core';

export class AdminAssistantMessageService {
  static getActiveBatchEntry(messages: AssistantMessage[]) {
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
        actions: AssistantAction[];
        actionBatch: NonNullable<AssistantMessage['actionBatch']>;
        ui?: AssistantMessage['ui'];
      }>;

    if (!candidates.length) return null;
    const source = candidates.some((item) => item.actionBatch.state !== 'stale')
      ? candidates.filter((item) => item.actionBatch.state !== 'stale')
      : candidates;

    return source.sort((a, b) => {
      const byTime = Number(b.actionBatch.createdAt || 0) - Number(a.actionBatch.createdAt || 0);
      return byTime !== 0 ? byTime : b.index - a.index;
    })[0];
  }

  static buildAssistantMessageFromResult(result: any, model: string, provider: string): AssistantMessage {
    const plan = result?.plan && typeof result.plan === 'object' ? result.plan : undefined;
    const ui = result?.ui && typeof result.ui === 'object' ? result.ui : undefined;
    const actions = Array.isArray(result?.actions) ? result.actions : [];
    const actionBatch =
      result?.actionBatch && typeof result.actionBatch === 'object'
        ? {
            id: String(result.actionBatch.id || '').trim() || `batch-${Date.now()}`,
            state: (String(result.actionBatch.state || 'staged').trim().toLowerCase() as 'staged' | 'previewed' | 'applied' | 'stale'),
            createdAt: Number(result.actionBatch.createdAt || Date.now()) || Date.now(),
          }
        : actions.length > 0
          ? { id: `batch-${Date.now()}`, state: 'staged' as const, createdAt: Date.now() }
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
        ['searching', 'staged', 'paused', 'ready_for_preview', 'ready_for_apply', 'failed'].includes(planStatus));
    const normalizedMessage = AssistantTextUtils.normalizeAssistantBodyText(String(result?.message || '').trim());
    const fallbackMessage =
      suppressPrimaryText ? '' : normalizedMessage || 'I finished this step. Tell me what you want to do next.';

    return {
      role: 'assistant',
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

  static appendAssistantMessage(messages: AssistantMessage[], assistantMessage: AssistantMessage): AssistantMessage[] {
    const hasFreshBatch =
      Array.isArray(assistantMessage.actions) &&
      assistantMessage.actions.length > 0 &&
      !!assistantMessage.actionBatch;
    const normalizedPrev = hasFreshBatch
      ? messages.map((entry) => {
          if (!entry.actionBatch) return entry;
          if (entry.actionBatch.state !== 'staged' && entry.actionBatch.state !== 'previewed') return entry;
          return {
            ...entry,
            actionBatch: { ...entry.actionBatch, state: 'stale' as const },
            ui: entry.ui
              ? {
                  ...entry.ui,
                  nextStep: 'none' as const,
                  workflowState: 'stale' as const,
                  primaryAction: 'none' as const,
                  userSummary: 'This batch is stale. Request a fresh batch.',
                  summaryMode: entry.ui.summaryMode || 'concise',
                }
              : entry.ui,
          };
        })
      : messages;
    return [...normalizedPrev, assistantMessage];
  }

  static mapHistorySession(item: any, fallbackProvider: string): ForgeHistorySession | null {
    const id = String(item?.id || '').trim();
    if (!id) return null;
    const providerValue = String(item?.provider || fallbackProvider || 'openai').trim().toLowerCase() || 'openai';
    const modeRaw = String(item?.chatMode || '').trim().toLowerCase();
    const mappedMode: 'auto' | 'plan' | 'agent' =
      modeRaw === 'plan' || modeRaw === 'agent'
        ? modeRaw
        : String(item?.agentMode || '').trim().toLowerCase() === 'advanced'
          ? 'plan'
          : 'auto';
    const messages = Array.isArray(item?.messages)
      ? item.messages
          .map((entry: any) => ({
            role:
              entry?.role === 'assistant' || entry?.role === 'system' || entry?.role === 'user'
                ? entry.role
                : 'assistant',
            content: String(entry?.content || '').trim(),
          }))
          .filter((entry: AssistantMessage) => !!entry.content)
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
