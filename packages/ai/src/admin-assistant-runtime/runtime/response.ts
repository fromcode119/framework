import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import { PrimaryAction } from '@ai/enums/primary-action.enum';
import { WorkflowState } from '@ai/enums/workflow-state.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantActionBatch } from '@ai/admin-assistant-runtime/interfaces/assistant-action-batch.interface';
import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';
import type { IAssistantChatTrace } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-trace.interface';
import type { IAssistantPlanArtifact } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-artifact.interface';
import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantUiHints } from '@ai/admin-assistant-runtime/interfaces/assistant-ui-hints.interface';
import { RuntimeUtils } from '@ai/admin-assistant-runtime/runtime/types';

export class ResponseBuilder {
  static stripBannedOpener(value: string): string {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
      .replace(/^(?:great question[,!.\s-]*|i['']?d be happy to help[,!.\s-]*|absolutely[,!.\s-]*)+/i, '')
      .trim();
  }

  static inferNextStep(input: { hasActions: boolean; needsClarification?: boolean }): NextStep {
    if (input.needsClarification) return NextStep.REPLY;
    if (input.hasActions) return NextStep.PREVIEW;
    return NextStep.REPLY;
  }

  static inferWorkflowState(input: { hasActions: boolean; needsClarification?: boolean }): WorkflowState {
    if (input.needsClarification) return WorkflowState.CLARIFY;
    if (input.hasActions) return WorkflowState.STAGED;
    return WorkflowState.REPLY;
  }

  static inferPrimaryAction(input: { hasActions: boolean; needsClarification?: boolean }): PrimaryAction {
    if (input.needsClarification) return PrimaryAction.SEND;
    if (input.hasActions) return PrimaryAction.PREVIEW;
    return PrimaryAction.SEND;
  }

  static inferUserSummary(input: {
    hasActions: boolean;
    needsClarification?: boolean;
    loopRecoveryMode?: ClarifyMode;
    clarifyingQuestion?: string;
  }): string {
    if (input.needsClarification) {
      const question = String(input.clarifyingQuestion || '').trim();
      return question || 'Need one detail to finish.';
    }
    if (input.loopRecoveryMode === ClarifyMode.BEST_EFFORT) return 'Draft ready; confirm target to apply.';
    if (input.hasActions) return 'Changes ready for review.';
    return 'Reply with a follow-up or request a change.';
  }

  static buildUiHintsBase(input: {
    hasActions: boolean;
    needsClarification?: boolean;
    loopRecoveryMode?: ClarifyMode;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    selectedSkill?: IAssistantSkillDefinition;
  }): IAssistantUiHints {
    return {
      canContinue: false,
      requiresApproval: !!input.hasActions && input.selectedSkill?.riskPolicy !== AssistantSkillRiskPolicy.ALLOWLISTED_AUTO_APPLY,
      suggestedMode: input.hasActions ? AssistantRunMode.PLAN : input.selectedSkill?.defaultMode || AssistantRunMode.CHAT,
      showTechnicalDetailsDefault: false,
      nextStep: ResponseBuilder.inferNextStep({ hasActions: input.hasActions, needsClarification: input.needsClarification }),
      summaryMode: ResponseVerbosity.CONCISE,
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
      loopRecoveryMode: input.loopRecoveryMode ?? ClarifyMode.NONE,
    };
  }

  static createActionBatch(actions: IAssistantAction[]): IAssistantActionBatch | undefined {
    if (!Array.isArray(actions) || actions.length === 0) return undefined;
    return { id: RuntimeUtils.createBatchId(), state: BatchState.STAGED, createdAt: Date.now() };
  }

  static makeCheckpoint(input: {
    reason: CheckpointReason;
    resumePrompt?: string;
    stage?: RuntimeStage;
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
  }): IAssistantSessionCheckpoint {
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
      reason: input.reason as IAssistantSessionCheckpoint['reason'],
      resumePrompt: String(input.resumePrompt || '').trim(),
      stage: input.stage ? RuntimeStage.resolve(input.stage) : undefined,
      planningPassesUsed: Number.isFinite(Number(input.planningPassesUsed))
        ? Math.max(0, Number(input.planningPassesUsed))
        : undefined,
      memory: normalizedMemory,
    };
  }

  static finalizeResult(input: {
    message: string;
    actions: IAssistantAction[];
    model: string;
    agentMode?: string;
    done?: boolean;
    traces?: unknown[];
    plan?: unknown;
    ui?: IAssistantUiHints;
    selectedSkill?: IAssistantSkillDefinition;
    sessionId?: string;
    checkpoint?: IAssistantSessionCheckpoint;
  }): IAssistantChatResult {
    const sanitizedMessage = ResponseBuilder.stripBannedOpener(input.message) || 'Ready.';
    const actions = Array.isArray(input.actions) ? input.actions : [];
    return {
      message: sanitizedMessage,
      actions,
      model: String(input.model || ''),
      agentMode: ContextLevel.resolve(input.agentMode ?? ContextLevel.BASIC.value),
      done: input.done !== false,
      traces: (Array.isArray(input.traces) ? input.traces : []) as IAssistantChatTrace[],
      plan: input.plan as IAssistantPlanArtifact | undefined,
      ui: input.ui,
      actionBatch: ResponseBuilder.createActionBatch(actions),
      skill: input.selectedSkill,
      sessionId: input.sessionId,
      checkpoint: input.checkpoint,
      iterations: (input.traces || []).length || 1,
      loopCapReached: false,
    };
  }

  static postProcessLegacyResult(result: Partial<IAssistantChatResult>): Partial<IAssistantChatResult> {
    const actions = Array.isArray(result?.actions) ? result.actions : [];
    const ui = result?.ui && typeof result.ui === 'object' ? { ...result.ui } : undefined;
    const normalizedUi = ui
      ? {
          ...ui,
          nextStep: ui.nextStep || ResponseBuilder.inferNextStep({ hasActions: actions.length > 0, needsClarification: ui.needsClarification }),
          summaryMode: ui.summaryMode ?? ResponseVerbosity.CONCISE,
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
          stage: result.checkpoint.stage ?? (normalizedUi?.needsClarification ? RuntimeStage.CLARIFY : RuntimeStage.FINALIZE),
        }
      : undefined;

    return {
      ...result,
      message: safeMessage || 'Ready.',
      ui: normalizedUi,
      actionBatch: result?.actionBatch || ResponseBuilder.createActionBatch(actions as IAssistantAction[]),
      checkpoint,
    };
  }
}
