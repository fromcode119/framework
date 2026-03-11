import type {
  AssistantAction, AssistantChatTrace, AssistantPlanArtifact, AssistantPlanStatus,
  AssistantPlanStep, AssistantRunMode, AssistantSkillDefinition, AssistantUiHints,
} from '../types';

/** Plan artifact and UI hints builders extracted from AdminAssistantRuntime. */
export class RuntimePlanHelpers {
  static buildPlanArtifact(input: {
    planId: string; goal: string; message: string; traces: AssistantChatTrace[];
    actions: AssistantAction[]; loopCapReached: boolean; loopTimeLimitReached: boolean;
    done: boolean; selectedSkill?: AssistantSkillDefinition; now: () => string;
  }): AssistantPlanArtifact {
    const { planId, goal, message, traces, actions, loopCapReached, loopTimeLimitReached, done, selectedSkill, now } = input;
    const timestamp = now();
    const summary = String(message || '').trim();
    const hasActions = Array.isArray(actions) && actions.length > 0;
    let status: AssistantPlanStatus = 'draft';
    if (hasActions) status = done ? 'ready_for_apply' : 'ready_for_preview';
    else if (loopCapReached || loopTimeLimitReached) status = 'paused';
    else if (done) status = 'completed';
    else if (Array.isArray(traces) && traces.length > 0) status = 'searching';
    const hasWriteActions = actions.some((a) => {
      if (a.type === 'create_content' || a.type === 'update_setting') return true;
      return a.type === 'mcp_call' && !String(a.tool || '').includes('.search_') && !String(a.tool || '').endsWith('.get');
    });
    const riskFromWrites: 'low' | 'medium' | 'high' = hasWriteActions ? 'medium' : 'low';
    const risk = selectedSkill?.riskPolicy === 'allowlisted_auto_apply' && hasWriteActions ? 'high' : selectedSkill?.riskPolicy === 'read_only' ? 'low' : riskFromWrites;
    const steps: AssistantPlanStep[] = (Array.isArray(traces) ? traces : []).map((trace, index, all) => ({
      id: `${planId}-step-${index + 1}`,
      title: trace?.message ? `${trace?.phase ? `${String(trace.phase).charAt(0).toUpperCase()}${String(trace.phase).slice(1)}: ` : ''}${String(trace.message).trim() || `Step ${index + 1}`}` : `Step ${index + 1}`,
      status: index === all.length - 1 && status === 'searching' ? 'running' : 'completed',
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
    selectedSkill?: AssistantSkillDefinition; planningPassesUsed?: number; needsClarification?: boolean;
    clarifyingQuestion?: string; missingInputs?: string[]; loopRecoveryMode?: 'none' | 'clarify' | 'best_effort';
  }): AssistantUiHints {
    const { hasActions, loopCapReached, loopTimeLimitReached, done, selectedSkill, planningPassesUsed, needsClarification, clarifyingQuestion, missingInputs, loopRecoveryMode } = input;
    const suggestedMode: AssistantRunMode = hasActions ? 'plan' : (loopCapReached || loopTimeLimitReached) && !done ? 'agent' : selectedSkill?.defaultMode || 'chat';
    const requiresApproval = hasActions && selectedSkill?.riskPolicy !== 'allowlisted_auto_apply';
    const passesUsed = Number(planningPassesUsed || 0);
    const canContinueMore = passesUsed < 3;
    return {
      canContinue: (loopCapReached || loopTimeLimitReached) && !hasActions && canContinueMore && !needsClarification && loopRecoveryMode !== 'best_effort',
      requiresApproval, suggestedMode, showTechnicalDetailsDefault: false,
      nextStep: hasActions ? 'preview' : needsClarification ? 'reply' : (loopCapReached || loopTimeLimitReached) && !hasActions && !done && canContinueMore ? 'none' : 'reply',
      summaryMode: 'concise', needsClarification: !!needsClarification,
      clarifyingQuestion: String(clarifyingQuestion || '').trim() || undefined,
      missingInputs: Array.isArray(missingInputs) ? missingInputs.filter(Boolean) : undefined,
      loopRecoveryMode: loopRecoveryMode || 'none',
    };
  }
}
