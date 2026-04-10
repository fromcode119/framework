import type {
  AssistantAction,
  AssistantActionBatch,
  AssistantChatResult,
  AssistantChatTrace,
  AssistantPlanArtifact,
  AssistantSessionCheckpoint,
  AssistantSkillDefinition,
  AssistantUiHints,
} from '../types';
import { RuntimeUtils } from './types';

export class ResponseBuilder {
  static stripBannedOpener(value: string): string {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
      .replace(/^(?:great question[,!.\s-]*|i['']?d be happy to help[,!.\s-]*|absolutely[,!.\s-]*)+/i, '')
      .trim();
  }

  static inferNextStep(input: { hasActions: boolean; needsClarification?: boolean }): 'reply' | 'preview' | 'apply' | 'none' {
    if (input.needsClarification) return 'reply';
    if (input.hasActions) return 'preview';
    return 'reply';
  }

  static inferWorkflowState(input: { hasActions: boolean; needsClarification?: boolean }): 'reply' | 'clarify' | 'staged' | 'previewed' | 'applied' | 'stale' {
    if (input.needsClarification) return 'clarify';
    if (input.hasActions) return 'staged';
    return 'reply';
  }

  static inferPrimaryAction(input: { hasActions: boolean; needsClarification?: boolean }): 'none' | 'send' | 'preview' | 'apply' {
    if (input.needsClarification) return 'send';
    if (input.hasActions) return 'preview';
    return 'send';
  }

  static inferUserSummary(input: {
    hasActions: boolean;
    needsClarification?: boolean;
    loopRecoveryMode?: string;
    clarifyingQuestion?: string;
  }): string {
    if (input.needsClarification) {
      const question = String(input.clarifyingQuestion || '').trim();
      return question || 'Need one detail to finish.';
    }
    if (input.loopRecoveryMode === 'best_effort') return 'Draft ready; confirm target to apply.';
    if (input.hasActions) return 'Changes ready for review.';
    return 'Reply with a follow-up or request a change.';
  }

  static buildUiHintsBase(input: {
    hasActions: boolean;
    needsClarification?: boolean;
    loopRecoveryMode?: string;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    selectedSkill?: AssistantSkillDefinition;
  }): AssistantUiHints {
    return {
      canContinue: false,
      requiresApproval: !!input.hasActions && input.selectedSkill?.riskPolicy !== 'allowlisted_auto_apply',
      suggestedMode: input.hasActions ? 'plan' : input.selectedSkill?.defaultMode || 'chat',
      showTechnicalDetailsDefault: false,
      nextStep: ResponseBuilder.inferNextStep({ hasActions: input.hasActions, needsClarification: input.needsClarification }),
      summaryMode: 'concise',
      workflowState: ResponseBuilder.inferWorkflowState({ hasActions: input.hasActions, needsClarification: input.needsClarification }),
      primaryAction: ResponseBuilder.inferPrimaryAction({ hasActions: input.hasActions, needsClarification: input.needsClarification }),
      userSummary: ResponseBuilder.inferUserSummary({
        hasActions: input.hasActions,
        needsClarification: input.needsClarification,
        loopRecoveryMode: input.loopRecoveryMode,
        clarifyingQuestion: input.clarifyingQuestion,
      }),
      needsClarification: !!input.needsClarification,
      clarifyingQuestion: String(input.clarifyingQuestion || '').trim() || undefined,
      missingInputs: Array.isArray(input.missingInputs) ? input.missingInputs.filter(Boolean) : undefined,
      loopRecoveryMode: (input.loopRecoveryMode || 'none') as 'none' | 'clarify' | 'best_effort',
    };
  }

  static createActionBatch(actions: AssistantAction[]): AssistantActionBatch | undefined {
    if (!Array.isArray(actions) || actions.length === 0) return undefined;
    return { id: RuntimeUtils.createBatchId(), state: 'staged', createdAt: Date.now() };
  }

  static makeCheckpoint(input: {
    reason: string;
    resumePrompt?: string;
    stage?: string;
    planningPassesUsed?: number;
    memory?: {
      listing?: {
        collectionSlug: string;
        lastSelectedRowIndex?: number;
        lastSelectedRecordId?: string;
        lastSelectedField?: string;
      };
      factual?: {
        tool: string;
        input?: Record<string, any>;
        rangeLabel?: string;
        rangeFrom?: string;
        rangeTo?: string;
        currency?: string;
        primaryMetricPath?: string;
        metrics?: Array<{ path: string; value: string | number | boolean }>;
      };
    };
  }): AssistantSessionCheckpoint {
    const listingMemory = input.memory?.listing;
    const factualMemory = input.memory?.factual;
    const normalizedMemory =
      (() => {
        const normalizedListing =
          listingMemory && String(listingMemory.collectionSlug || '').trim()
            ? {
                collectionSlug: String(listingMemory.collectionSlug).trim(),
                lastSelectedRowIndex: Number.isFinite(Number(listingMemory.lastSelectedRowIndex))
                  ? Math.max(0, Number(listingMemory.lastSelectedRowIndex))
                  : undefined,
                lastSelectedRecordId: String(listingMemory.lastSelectedRecordId || '').trim() || undefined,
                lastSelectedField: String(listingMemory.lastSelectedField || '').trim() || undefined,
              }
            : undefined;
        const normalizedFactual =
          factualMemory && String(factualMemory.tool || '').trim()
            ? {
                tool: String(factualMemory.tool).trim(),
                input: factualMemory.input && typeof factualMemory.input === 'object'
                  ? { ...factualMemory.input }
                  : undefined,
                rangeLabel: String(factualMemory.rangeLabel || '').trim() || undefined,
                rangeFrom: String(factualMemory.rangeFrom || '').trim() || undefined,
                rangeTo: String(factualMemory.rangeTo || '').trim() || undefined,
                currency: String(factualMemory.currency || '').trim() || undefined,
                primaryMetricPath: String(factualMemory.primaryMetricPath || '').trim() || undefined,
                metrics: Array.isArray(factualMemory.metrics)
                  ? factualMemory.metrics
                      .filter((entry) => entry && typeof entry === 'object')
                      .map((entry) => ({
                        path: String(entry.path || '').trim(),
                        value: entry.value as string | number | boolean,
                      }))
                      .filter((entry) => !!entry.path)
                      .slice(0, 24)
                  : undefined,
              }
            : undefined;
        if (!normalizedListing && !normalizedFactual) {
          return undefined;
        }
        return {
          listing: normalizedListing,
          factual: normalizedFactual,
        };
      })();
    return {
      reason: input.reason as AssistantSessionCheckpoint['reason'],
      resumePrompt: String(input.resumePrompt || '').trim(),
      stage: input.stage as AssistantSessionCheckpoint['stage'],
      planningPassesUsed: Number.isFinite(Number(input.planningPassesUsed))
        ? Math.max(0, Number(input.planningPassesUsed))
        : undefined,
      memory: normalizedMemory,
    };
  }

  static finalizeResult(input: {
    message: string;
    actions: AssistantAction[];
    model: string;
    agentMode?: string;
    done?: boolean;
    traces?: unknown[];
    plan?: unknown;
    ui?: AssistantUiHints;
    selectedSkill?: AssistantSkillDefinition;
    sessionId?: string;
    checkpoint?: AssistantSessionCheckpoint;
  }): AssistantChatResult {
    const sanitizedMessage = ResponseBuilder.stripBannedOpener(input.message) || 'Ready.';
    const actions = Array.isArray(input.actions) ? input.actions : [];
    return {
      message: sanitizedMessage,
      actions,
      model: String(input.model || ''),
      agentMode: (input.agentMode || 'basic') as 'basic' | 'advanced',
      done: input.done !== false,
      traces: (Array.isArray(input.traces) ? input.traces : []) as AssistantChatTrace[],
      plan: input.plan as AssistantPlanArtifact | undefined,
      ui: input.ui,
      actionBatch: ResponseBuilder.createActionBatch(actions),
      skill: input.selectedSkill,
      sessionId: input.sessionId,
      checkpoint: input.checkpoint,
      iterations: (input.traces || []).length || 1,
      loopCapReached: false,
    };
  }

  static postProcessLegacyResult(result: Partial<AssistantChatResult>): Partial<AssistantChatResult> {
    const actions = Array.isArray(result?.actions) ? result.actions : [];
    const ui = result?.ui && typeof result.ui === 'object' ? { ...result.ui } : undefined;
    const normalizedUi = ui
      ? {
          ...ui,
          nextStep: ui.nextStep || ResponseBuilder.inferNextStep({ hasActions: actions.length > 0, needsClarification: ui.needsClarification }),
          summaryMode: ui.summaryMode || 'concise',
          workflowState: ui.workflowState || ResponseBuilder.inferWorkflowState({ hasActions: actions.length > 0, needsClarification: ui.needsClarification }),
          primaryAction: ui.primaryAction || ResponseBuilder.inferPrimaryAction({ hasActions: actions.length > 0, needsClarification: ui.needsClarification }),
          userSummary:
            String(ui.userSummary || '').trim() ||
            ResponseBuilder.inferUserSummary({
              hasActions: actions.length > 0,
              needsClarification: ui.needsClarification,
              loopRecoveryMode: ui.loopRecoveryMode,
              clarifyingQuestion: ui.clarifyingQuestion,
            }),
        }
      : undefined;

    const saysAppliedWithoutActions =
      actions.length === 0 &&
      /\b(applied|updated|changed|done)\b/i.test(String(result?.message || '')) &&
      !/\b(no changes|not changed|not found|no safe actions)\b/i.test(String(result?.message || ''));
    const safeMessage = saysAppliedWithoutActions
      ? 'I did not apply changes yet. I can stage exact actions once target details are clear.'
      : ResponseBuilder.stripBannedOpener(String(result?.message || ''));

    const checkpoint = result?.checkpoint
      ? {
          ...result.checkpoint,
          stage: result.checkpoint.stage || (normalizedUi?.needsClarification ? 'clarify' : 'finalize'),
        }
      : undefined;

    return {
      ...result,
      message: safeMessage || 'Ready.',
      ui: normalizedUi,
      actionBatch: result?.actionBatch || ResponseBuilder.createActionBatch(actions as AssistantAction[]),
      checkpoint,
    };
  }
}
