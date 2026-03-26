import type {
  AssistantAction,
  AssistantPlanArtifact,
  AssistantPlanStatus,
  AssistantSkillDefinition,
  AssistantUiHints,
} from '../admin-assistant-runtime/types';

export class AdminAssistantRuntimeArtifactService {
  constructor(private readonly now: () => string) {}

  buildPlanArtifact(input: {
    planId: string;
    goal: string;
    message: string;
    actions: AssistantAction[];
    traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: AssistantSkillDefinition;
  }): AssistantPlanArtifact {
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
      if (action.type === 'create_content' || action.type === 'update_setting') return true;
      return action.type === 'mcp_call' && !String(action.tool || '').includes('.search_') && !String(action.tool || '').endsWith('.get');
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
        status: index === all.length - 1 && status === 'searching' ? 'running' : 'completed',
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
    selectedSkill?: AssistantSkillDefinition;
    planningPassesUsed?: number;
    needsClarification?: boolean;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    loopRecoveryMode?: 'none' | 'clarify' | 'best_effort';
  }): AssistantUiHints {
    const suggestedMode = input.hasActions
      ? 'plan'
      : (input.loopCapReached || input.loopTimeLimitReached) && !input.done
        ? 'agent'
        : input.selectedSkill?.defaultMode || 'chat';
    const passesUsed = Number(input.planningPassesUsed || 0);

    return {
      canContinue:
        (input.loopCapReached || input.loopTimeLimitReached) &&
        !input.hasActions &&
        passesUsed < 3 &&
        !input.needsClarification &&
        input.loopRecoveryMode !== 'best_effort',
      requiresApproval: input.hasActions && input.selectedSkill?.riskPolicy !== 'allowlisted_auto_apply',
      suggestedMode,
      showTechnicalDetailsDefault: false,
      nextStep: input.hasActions ? 'preview' : 'reply',
      summaryMode: 'concise',
      needsClarification: !!input.needsClarification,
      clarifyingQuestion: String(input.clarifyingQuestion || '').trim() || undefined,
      missingInputs: Array.isArray(input.missingInputs) ? input.missingInputs.filter(Boolean) : undefined,
      loopRecoveryMode: input.loopRecoveryMode || 'none',
    };
  }

  private resolvePlanStatus(
    hasActions: boolean,
    done: boolean,
    loopCapReached: boolean,
    loopTimeLimitReached: boolean,
    traces: Array<{ iteration: number }> | undefined,
  ): AssistantPlanStatus {
    if (hasActions) return done ? 'ready_for_apply' : 'ready_for_preview';
    if (loopCapReached || loopTimeLimitReached) return 'paused';
    if (done) return 'completed';
    if (Array.isArray(traces) && traces.length > 0) return 'searching';
    return 'draft';
  }

  private resolveRisk(
    selectedSkill: AssistantSkillDefinition | undefined,
    hasWriteActions: boolean,
  ): 'low' | 'medium' | 'high' {
    if (selectedSkill?.riskPolicy === 'allowlisted_auto_apply' && hasWriteActions) return 'high';
    if (selectedSkill?.riskPolicy === 'read_only') return 'low';
    return hasWriteActions ? 'medium' : 'low';
  }
}
