import { AssistantActionType } from '@ai/admin-assistant-runtime/enums/assistant-action-type.enum';
import { PlanStepStatus } from '@ai/admin-assistant-runtime/enums/plan-step-status.enum';
import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';
import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';
import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantPlanArtifact } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-artifact.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantUiHints } from '@ai/admin-assistant-runtime/interfaces/assistant-ui-hints.interface';
import { AssistantPlanStatus } from '@ai/admin-assistant-runtime/enums/assistant-plan-status.enum';

export class AdminAssistantRuntimeArtifactService {
  constructor(private readonly now: () => string) {}

  buildPlanArtifact(input: {
    planId: string;
    goal: string;
    message: string;
    actions: IAssistantAction[];
    traces: Array<{ iteration: number; message: string; phase?: AgentRole; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: IAssistantSkillDefinition;
  }): IAssistantPlanArtifact {
    const nowIso = this.now();
    const hasActions = Array.isArray(input.actions) && input.actions.length > 0;
    const status = this.resolvePlanStatus(
      hasActions,
      input.done,
      input.loopCapReached,
      input.loopTimeLimitReached,
      input.traces,
    );
    const hasWriteActions = input.actions.some((action) => {
      if (action.type === AssistantActionType.CREATE_CONTENT || action.type === AssistantActionType.UPDATE_SETTING) return true;
      return action.type === AssistantActionType.MCP_CALL && !String(action.tool || '').includes('.search_') && !String(action.tool || '').endsWith('.get');
    });

    return {
      id: input.planId,
      status,
      goal: String(input.goal || '').trim() || 'User request',
      summary: String(input.message || '').trim() || (hasActions ? 'Staged actions are ready for preview.' : 'No staged actions yet.'),
      steps: (Array.isArray(input.traces) ? input.traces : []).map((trace, index, all) => ({
        id: `${input.planId}-step-${index + 1}`,
        title: trace?.message
          ? `${trace?.phase ? `${String(trace.phase).charAt(0).toUpperCase()}${String(trace.phase).slice(1)}: ` : ''}${String(trace.message).trim() || `Step ${index + 1}`}`
          : `Step ${index + 1}`,
        status: index === all.length - 1 && status === AssistantPlanStatus.SEARCHING ? PlanStepStatus.RUNNING : PlanStepStatus.COMPLETED,
        description: trace?.message ? String(trace.message).trim() : undefined,
        toolCalls: Array.isArray(trace?.toolCalls) ? trace.toolCalls : [],
      })),
      actions: Array.isArray(input.actions) ? input.actions : [],
      risk: this.resolveRisk(input.selectedSkill, hasWriteActions),
      previewReady: hasActions,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  buildUiHints(input: {
    hasActions: boolean;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: IAssistantSkillDefinition;
    planningPassesUsed?: number;
    needsClarification?: boolean;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    loopRecoveryMode?: ClarifyMode;
  }): IAssistantUiHints {
    const suggestedMode: AssistantRunMode = input.hasActions
      ? AssistantRunMode.PLAN
      : (input.loopCapReached || input.loopTimeLimitReached) && !input.done
        ? AssistantRunMode.AGENT
        : AssistantRunMode.resolve(input.selectedSkill?.defaultMode ?? AssistantRunMode.CHAT.value);
    const passesUsed = Number(input.planningPassesUsed || 0);

    return {
      canContinue:
        (input.loopCapReached || input.loopTimeLimitReached) &&
        !input.hasActions &&
        passesUsed < 3 &&
        !input.needsClarification &&
        input.loopRecoveryMode !== ClarifyMode.BEST_EFFORT,
      requiresApproval: input.hasActions && input.selectedSkill?.riskPolicy !== AssistantSkillRiskPolicy.ALLOWLISTED_AUTO_APPLY,
      suggestedMode,
      showTechnicalDetailsDefault: false,
      nextStep: input.hasActions ? NextStep.PREVIEW : NextStep.REPLY,
      summaryMode: ResponseVerbosity.CONCISE,
      needsClarification: !!input.needsClarification,
      clarifyingQuestion: String(input.clarifyingQuestion || '').trim() || undefined,
      missingInputs: Array.isArray(input.missingInputs) ? input.missingInputs.filter(Boolean) : undefined,
      loopRecoveryMode: input.loopRecoveryMode || ClarifyMode.NONE,
    };
  }

  private resolvePlanStatus(
    hasActions: boolean,
    done: boolean,
    loopCapReached: boolean,
    loopTimeLimitReached: boolean,
    traces: Array<{ iteration: number }> | undefined,
  ): AssistantPlanStatus {
    if (hasActions) return done ? AssistantPlanStatus.READY_FOR_APPLY : AssistantPlanStatus.READY_FOR_PREVIEW;
    if (loopCapReached || loopTimeLimitReached) return AssistantPlanStatus.PAUSED;
    if (done) return AssistantPlanStatus.COMPLETED;
    if (Array.isArray(traces) && traces.length > 0) return AssistantPlanStatus.SEARCHING;
    return AssistantPlanStatus.DRAFT;
  }

  private resolveRisk(
    selectedSkill: IAssistantSkillDefinition | undefined,
    hasWriteActions: boolean,
  ): ComplexityTier {
    if (selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.ALLOWLISTED_AUTO_APPLY && hasWriteActions) return ComplexityTier.HIGH;
    if (selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.READ_ONLY) return ComplexityTier.LOW;
    return hasWriteActions ? ComplexityTier.MEDIUM : ComplexityTier.LOW;
  }
}
