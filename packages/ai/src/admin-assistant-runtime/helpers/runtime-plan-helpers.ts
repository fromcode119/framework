import { AssistantActionType } from '@ai/admin-assistant-runtime/enums/assistant-action-type.enum';
import { PlanStepStatus } from '@ai/admin-assistant-runtime/enums/plan-step-status.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantChatTrace } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-trace.interface';
import type { IAssistantPlanArtifact } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-artifact.interface';
import type { IAssistantPlanStep } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-step.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantUiHints } from '@ai/admin-assistant-runtime/interfaces/assistant-ui-hints.interface';
import { AssistantPlanStatus } from '@ai/admin-assistant-runtime/enums/assistant-plan-status.enum';

/** Plan artifact and UI hints builders extracted from AdminAssistantRuntime. */
export class RuntimePlanHelpers {
  static buildPlanArtifact(input: {
    planId: string; goal: string; message: string; traces: IAssistantChatTrace[];
    actions: IAssistantAction[]; loopCapReached: boolean; loopTimeLimitReached: boolean;
    done: boolean; selectedSkill?: IAssistantSkillDefinition; now: () => string;
  }): IAssistantPlanArtifact {
    const { planId, goal, message, traces, actions, loopCapReached, loopTimeLimitReached, done, selectedSkill, now } = input;
    const timestamp = now();
    const summary = String(message || '').trim();
    const hasActions = Array.isArray(actions) && actions.length > 0;
    let status: AssistantPlanStatus = AssistantPlanStatus.DRAFT;
    if (hasActions) status = done ? AssistantPlanStatus.READY_FOR_APPLY : AssistantPlanStatus.READY_FOR_PREVIEW;
    else if (loopCapReached || loopTimeLimitReached) status = AssistantPlanStatus.PAUSED;
    else if (done) status = AssistantPlanStatus.COMPLETED;
    else if (Array.isArray(traces) && traces.length > 0) status = AssistantPlanStatus.SEARCHING;
    const hasWriteActions = actions.some((a) => {
      if (a.type === AssistantActionType.CREATE_CONTENT || a.type === AssistantActionType.UPDATE_SETTING) return true;
      return a.type === AssistantActionType.MCP_CALL && !String(a.tool || '').includes('.search_') && !String(a.tool || '').endsWith('.get');
    });
    const riskFromWrites: ComplexityTier = hasWriteActions ? ComplexityTier.MEDIUM : ComplexityTier.LOW;
    const risk = selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.ALLOWLISTED_AUTO_APPLY && hasWriteActions ? ComplexityTier.HIGH : selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.READ_ONLY ? ComplexityTier.LOW : riskFromWrites;
    const steps: IAssistantPlanStep[] = (Array.isArray(traces) ? traces : []).map((trace, index, all) => ({
      id: `${planId}-step-${index + 1}`,
      title: trace?.message ? `${trace?.phase ? `${String(trace.phase).charAt(0).toUpperCase()}${String(trace.phase).slice(1)}: ` : ''}${String(trace.message).trim() || `Step ${index + 1}`}` : `Step ${index + 1}`,
      status: index === all.length - 1 && status === AssistantPlanStatus.SEARCHING ? PlanStepStatus.RUNNING : PlanStepStatus.COMPLETED,
      description: trace?.message ? String(trace.message).trim() : undefined,
      toolCalls: Array.isArray(trace?.toolCalls) ? trace.toolCalls : [],
    }));
    return {
      id: planId, status, goal: String(goal || '').trim() || 'User request',
      summary: summary || (hasActions ? 'Staged actions are ready for preview.' : 'No staged actions yet.'),
      steps, actions: Array.isArray(actions) ? actions : [], risk, previewReady: hasActions,
      createdAt: timestamp, updatedAt: timestamp,
    };
  }

  static buildUiHints(input: {
    hasActions: boolean; loopCapReached: boolean; loopTimeLimitReached: boolean; done: boolean;
    selectedSkill?: IAssistantSkillDefinition; planningPassesUsed?: number; needsClarification?: boolean;
    clarifyingQuestion?: string; missingInputs?: string[]; loopRecoveryMode?: ClarifyMode;
  }): IAssistantUiHints {
    const { hasActions, loopCapReached, loopTimeLimitReached, done, selectedSkill, planningPassesUsed, needsClarification, clarifyingQuestion, missingInputs, loopRecoveryMode } = input;
    const suggestedMode: AssistantRunMode = hasActions ? AssistantRunMode.PLAN : (loopCapReached || loopTimeLimitReached) && !done ? AssistantRunMode.AGENT : selectedSkill?.defaultMode || AssistantRunMode.CHAT;
    const requiresApproval = hasActions && selectedSkill?.riskPolicy !== AssistantSkillRiskPolicy.ALLOWLISTED_AUTO_APPLY;
    const passesUsed = Number(planningPassesUsed || 0);
    const canContinueMore = passesUsed < 3;
    return {
      canContinue: (loopCapReached || loopTimeLimitReached) && !hasActions && canContinueMore && !needsClarification && loopRecoveryMode !== ClarifyMode.BEST_EFFORT,
      requiresApproval, suggestedMode, showTechnicalDetailsDefault: false,
      nextStep: hasActions ? NextStep.PREVIEW : needsClarification ? NextStep.REPLY : (loopCapReached || loopTimeLimitReached) && !hasActions && !done && canContinueMore ? NextStep.NONE : NextStep.REPLY,
      summaryMode: ResponseVerbosity.CONCISE, needsClarification: !!needsClarification,
      clarifyingQuestion: String(clarifyingQuestion || '').trim() || undefined,
      missingInputs: Array.isArray(missingInputs) ? missingInputs.filter(Boolean) : undefined,
      loopRecoveryMode: loopRecoveryMode || ClarifyMode.NONE,
    };
  }
}
