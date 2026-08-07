import { AssistantActionType } from '@ai/admin-assistant-runtime/enums/assistant-action-type.enum';
import { ReplyIntent } from '@ai/admin-assistant-runtime/enums/reply-intent.enum';
import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import type { IMcpBridge } from '@fromcode119/mcp';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';
import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';
import type { IAssistantChatTrace } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-trace.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';
import { AssistantCopyUtils } from '@ai/assistant-copy';
import { IntentClassifier } from '@ai/admin-assistant-runtime/intents';
import { ReplaceContentHelpers } from '@ai/admin-assistant-runtime/helpers/replace-content-helpers';
import { ActionSafetyHelpers } from '@ai/admin-assistant-runtime/helpers/action-safety-helpers';
import { RuntimeMiscHelpers } from '@ai/admin-assistant-runtime/helpers/runtime-misc-helpers';
import { ReplyMessageBuilders } from '@ai/admin-assistant-runtime/helpers/reply-message-builders';
import { HomepageDraftHelpers } from '@ai/admin-assistant-runtime/helpers/homepage-draft-helpers';

export class ChatAgentLoopHelpers {
  static async run(
    message: string, input: IAssistantChatInput, options: IAdminAssistantRuntimeOptions,
    normalizedHistory: IAssistantMessage[], mcpBridge: IMcpBridge, availableTools: IAssistantToolSummary[],
    isToolAllowed: (t: string) => boolean, agentMode: ContextLevel, maxIterations: number, maxDurationMs: number,
    selectedSkill: IAssistantSkillDefinition, planId: string, sessionId: string | undefined,
    replaceInstruction: { from: string; to: string } | null, replaceFlowMessage: string,
    systemPrompt: string,
    sanitize: (msg: string, mode: ContextLevel) => string, buildPlan: (opts: any) => any, buildUi: (opts: any) => any,
    aiClient: any,
  ): Promise<IAssistantChatResult> {
    const collections = options.getCollections();
    const loopHistory: IAssistantMessage[] = [...normalizedHistory];
    const stagedActions: IAssistantAction[] = [];
    const traces: IAssistantChatTrace[] = [];
    let assistantMessage: string = AssistantCopyUtils.RUNTIME_COPY.noResponseGenerated;
    let usedModel = ''; let loopDone = false; let loopCapReached = false; let iterationsRan = 0; let loopTimeLimitReached = false;
    let currentPrompt = message;
    const inferredSearchQuery = RuntimeMiscHelpers.inferSearchQueryFromPrompt(message);
    let lastExecutedToolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
    const allExecutedToolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
    const loopStartedAt = Date.now();

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      if (Date.now() - loopStartedAt > maxDurationMs) { loopCapReached = true; loopTimeLimitReached = true; break; }
      iterationsRan = iteration + 1;
      const completion = await aiClient.chat({ messages: [{ role: 'system', content: systemPrompt }, ...loopHistory, { role: 'user', content: currentPrompt }], json: true, temperature: 0.2, maxTokens: 1600 });
      usedModel = completion.model || usedModel;
      const extracted = RuntimeMiscHelpers.extractJsonObject(completion.content);
      const parsed = extracted || {};
      const parsedMessage = String(parsed?.message || '').trim();
      const parsedActions = ChatAgentLoopHelpers._sanitizeActions(Array.isArray(parsed?.actions) ? parsed.actions : []);
      if (parsedActions.length) stagedActions.push(...parsedActions);
      const rawToolCalls = Array.isArray(parsed?.toolCalls) ? parsed.toolCalls : Array.isArray(parsed?.tools) ? parsed.tools : [];
      const toolCalls = rawToolCalls.filter((i: any) => i && typeof i === 'object').map((i: any) => ({ tool: String(i.tool || i.name || '').trim(), input: i.input && typeof i.input === 'object' ? i.input : {} })).filter((i: any) => !!i.tool);
      const rawMessage = parsedMessage || (!extracted && agentMode !== ContextLevel.ADVANCED ? String(completion.content || '').trim() : '');
      if (rawMessage) assistantMessage = rawMessage;
      else if (parsedActions.length || toolCalls.length) {
        if (toolCalls.length && !parsedActions.length) assistantMessage = AssistantCopyUtils.RUNTIME_COPY.gatheringContext;
        else if (parsedActions.length && !toolCalls.length) assistantMessage = AssistantCopyUtils.RUNTIME_COPY.stagedActionsReady;
        else assistantMessage = AssistantCopyUtils.RUNTIME_COPY.collectedContextAndActions;
      }
      traces.push({ iteration: iteration + 1, message: rawMessage, phase: AgentRole.PLANNER, toolCalls });
      const done = parsed?.done === true;
      if (done) loopDone = true;
      if (agentMode === ContextLevel.ADVANCED && !done && toolCalls.length === 0 && iteration < maxIterations - 1) {
        loopHistory.push({ role: AssistantRole.ASSISTANT, content: rawMessage || `Iteration ${iteration + 1}` });
        while (loopHistory.length > 18) loopHistory.shift();
        currentPrompt = 'Return a FINAL response now. Summarize findings from prior tool results and stage any needed write actions. Set done=true.';
        continue;
      }
      if (!agentMode || agentMode !== ContextLevel.ADVANCED || done || toolCalls.length === 0) break;
      const toolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
      const executedToolCalls: Array<{ tool: string; input: Record<string, any> }> = [];
      for (const call of toolCalls) {
        if (Date.now() - loopStartedAt > maxDurationMs) { loopCapReached = true; loopTimeLimitReached = true; break; }
        const callInput = call.input && typeof call.input === 'object' ? { ...call.input } : {};
        if (/(?:^|\.)(search_text)$/.test(String(call.tool || '')) && !String((callInput as any)?.query || '').trim() && inferredSearchQuery) (callInput as any).query = inferredSearchQuery;
        if (!isToolAllowed(call.tool)) { toolResults.push({ tool: call.tool, input: callInput, result: { ok: false, error: `Tool "${call.tool}" is not enabled for this run.` } }); continue; }
        const result = await mcpBridge.call({ tool: call.tool, input: callInput, context: { dryRun: true } });
        executedToolCalls.push({ tool: call.tool, input: callInput });
        toolResults.push({ tool: call.tool, input: callInput, result });
      }
      if (loopTimeLimitReached) break;
      lastExecutedToolResults = toolResults; allExecutedToolResults.push(...toolResults);
      traces.push({ iteration: iteration + 1, phase: AgentRole.EXECUTOR, message: `Executed ${toolResults.length} tool call${toolResults.length === 1 ? '' : 's'} in dry-run context.`, toolCalls: executedToolCalls });
      const verifierErrorCount = toolResults.filter((i) => i?.result?.ok === false || i?.result?.error).length;
      traces.push({ iteration: iteration + 1, phase: AgentRole.VERIFIER, message: verifierErrorCount ? `Verifier: ${verifierErrorCount} tool call${verifierErrorCount === 1 ? '' : 's'} returned errors. Refining next step.` : 'Verifier: tool outputs collected. Continuing with the next best step.', toolCalls: [] });
      loopHistory.push({ role: AssistantRole.ASSISTANT, content: rawMessage || `Iteration ${iteration + 1}` }, { role: AssistantRole.SYSTEM, content: `TOOL_RESULTS_JSON:${JSON.stringify(toolResults)}` });
      while (loopHistory.length > 18) loopHistory.shift();
      currentPrompt = 'Continue with the next best step. Use tools if needed, then return final staged actions when done.';
    }
    if (!loopDone && iterationsRan >= maxIterations) loopCapReached = true;

    const dedupedActions = Array.from(new Map(stagedActions.map((a) => [JSON.stringify(a), a])).values());
    let safeActions = await ActionSafetyHelpers.filterUnsafeStagedActions(dedupedActions, availableTools, options);
    let needsClarification = false; let clarifyingQuestion = ''; let missingInputs: string[] = []; let loopRecoveryMode: ClarifyMode = ClarifyMode.NONE; let recoveryCheckpointReason: IAssistantSessionCheckpoint['reason'] | undefined; let recoveryResumePrompt = '';
    const readOnlyDiscoveryIntent = IntentClassifier.isReadOnlyDiscoveryIntent(message);

    if (readOnlyDiscoveryIntent && safeActions.length) { safeActions = []; if (allExecutedToolResults.length > 0) assistantMessage = ReplyMessageBuilders.buildToolResultsFallbackMessage(allExecutedToolResults, assistantMessage, RuntimeMiscHelpers.formatToolLabel); }
    if (readOnlyDiscoveryIntent) {
      const discoveryResults = [...allExecutedToolResults];
      const discoveryQuery = RuntimeMiscHelpers.inferSearchQueryFromPrompt(message);
      if (!discoveryResults.some((i) => String(i?.tool || '') === 'content.search_text') && discoveryQuery) { const r = await mcpBridge.call({ tool: 'content.search_text', input: { query: discoveryQuery, maxMatches: 80 }, context: { dryRun: true } }); discoveryResults.push({ tool: 'content.search_text', input: { query: discoveryQuery, maxMatches: 80 }, result: r }); }
      if (discoveryResults.length > 0) assistantMessage = ReplyMessageBuilders.buildToolResultsFallbackMessage(discoveryResults, assistantMessage, RuntimeMiscHelpers.formatToolLabel);
    }
    if (!readOnlyDiscoveryIntent && !safeActions.length && allExecutedToolResults.length > 0) {
      const fallbackActions = await ReplaceContentHelpers.stageFallbackReplaceActions(replaceFlowMessage, allExecutedToolResults, mcpBridge, options);
      if (fallbackActions.length) { safeActions = await ActionSafetyHelpers.filterUnsafeStagedActions(fallbackActions, availableTools, options); if (safeActions.length) { assistantMessage = AssistantCopyUtils.buildStagedReplacementMessage(safeActions.length); loopDone = true; } }
    }
    const interimMessage = RuntimeMiscHelpers.isInterimPlanningMessage(assistantMessage);
    if (!safeActions.length && allExecutedToolResults.length > 0) { if (RuntimeMiscHelpers.shouldUseToolSummaryOverride(assistantMessage, allExecutedToolResults) || interimMessage) assistantMessage = ReplyMessageBuilders.buildToolResultsFallbackMessage(allExecutedToolResults, assistantMessage, RuntimeMiscHelpers.formatToolLabel); }
    else if (!safeActions.length && lastExecutedToolResults.length > 0) { if (interimMessage || /no response generated/i.test(String(assistantMessage || ''))) assistantMessage = ReplyMessageBuilders.buildToolResultsFallbackMessage(lastExecutedToolResults, assistantMessage, RuntimeMiscHelpers.formatToolLabel); }
    if (!safeActions.length && !readOnlyDiscoveryIntent && !replaceInstruction) { const current = String(assistantMessage || '').trim(); if (!current || RuntimeMiscHelpers.isInterimPlanningMessage(current) || /no safe executable plan|plan stopped before executable actions/i.test(current)) assistantMessage = AssistantCopyUtils.RUNTIME_COPY.noSafeWriteActions; }
    if (!safeActions.length && loopCapReached && RuntimeMiscHelpers.containsPlaceholderTarget(assistantMessage)) assistantMessage = AssistantCopyUtils.RUNTIME_COPY.noReliablePlan;
    if (!safeActions.length && loopCapReached && !readOnlyDiscoveryIntent && !replaceInstruction) {
      const clarificationIntent = IntentClassifier.isHomepageDraftIntent(message) ? ReplyIntent.HOMEPAGE_DRAFT : ReplyIntent.GENERAL;
      const candidateCollections = clarificationIntent === ReplyIntent.HOMEPAGE_DRAFT ? HomepageDraftHelpers.homepageCandidateCollections(collections).map((e) => e.slug) : [];
      const clarification = ReplyMessageBuilders.buildClarificationRequest(clarificationIntent, candidateCollections);
      const priorPauseCount = ReplyMessageBuilders.countRecentReplacementPauseMessages(normalizedHistory);
      needsClarification = true; clarifyingQuestion = clarification.question; missingInputs = clarification.missingInputs; recoveryResumePrompt = clarification.resumePrompt;
      if (priorPauseCount > 0 && ReplyMessageBuilders.isGenericPauseCopy(assistantMessage) || input?.checkpoint?.reason === CheckpointReason.CLARIFICATION_NEEDED) { loopRecoveryMode = ClarifyMode.BEST_EFFORT; recoveryCheckpointReason = CheckpointReason.LOOP_RECOVERY; assistantMessage = `${AssistantCopyUtils.RUNTIME_COPY.bestEffortDraftReady} ${clarifyingQuestion}`; }
      else { loopRecoveryMode = ClarifyMode.CLARIFY; recoveryCheckpointReason = CheckpointReason.CLARIFICATION_NEEDED; assistantMessage = clarifyingQuestion; }
    }
    if (!safeActions.length && loopRecoveryMode === ClarifyMode.NONE) { const current = String(assistantMessage || '').trim(); if (!current || RuntimeMiscHelpers.isInterimPlanningMessage(current)) assistantMessage = AssistantCopyUtils.buildPlannerNoActionMessage({ loopDone, loopCapReached, loopTimeLimitReached }); }
    if (selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.READ_ONLY && safeActions.length > 0) { safeActions = []; assistantMessage = AssistantCopyUtils.RUNTIME_COPY.readOnlySkillBlocked; }

    const normalizedPlanMessage = RuntimeMiscHelpers.normalizePlanModeMessage(assistantMessage, agentMode, safeActions.length > 0, loopDone || safeActions.length > 0);
    const userFacingMessage = sanitize(normalizedPlanMessage, agentMode);
    const done = loopDone || safeActions.length > 0 || needsClarification || loopRecoveryMode === ClarifyMode.BEST_EFFORT;
    const effectiveLoopCapReached = loopRecoveryMode === ClarifyMode.NONE ? loopCapReached : false;
    const planningPassesUsed = input.continueFrom && input.checkpoint?.planningPassesUsed ? input.checkpoint.planningPassesUsed + 1 : 0;
    const ui = buildUi({ hasActions: safeActions.length > 0, loopCapReached: effectiveLoopCapReached, loopTimeLimitReached: loopRecoveryMode === ClarifyMode.NONE ? loopTimeLimitReached : false, done, planningPassesUsed, needsClarification, clarifyingQuestion, missingInputs, loopRecoveryMode });
    const checkpoint: IAssistantSessionCheckpoint | undefined = recoveryCheckpointReason ? { resumePrompt: recoveryResumePrompt || 'Continue planning from previous context and stage executable actions if safe.', reason: recoveryCheckpointReason, stage: recoveryCheckpointReason === CheckpointReason.CLARIFICATION_NEEDED ? RuntimeStage.CLARIFY : RuntimeStage.FINALIZE, planningPassesUsed } : ui.canContinue ? { resumePrompt: 'Continue planning from previous context. Run more steps and stage executable actions if safe.', reason: loopTimeLimitReached ? CheckpointReason.TIME_CAP : CheckpointReason.LOOP_CAP, stage: RuntimeStage.PLAN, planningPassesUsed } : undefined;
    return { message: userFacingMessage, actions: safeActions, model: usedModel, agentMode: agentMode, done, traces, plan: buildPlan({ message: userFacingMessage, traces, actions: safeActions, loopCapReached: effectiveLoopCapReached, loopTimeLimitReached: loopRecoveryMode === ClarifyMode.NONE ? loopTimeLimitReached : false, done }), ui, skill: selectedSkill, sessionId, checkpoint, iterations: iterationsRan, loopCapReached: effectiveLoopCapReached };
  }

  /**
   * NOTE: validate the RAW type, do not `resolve()` then match strings. `resolve()` returns an
   * `AssistantActionType`, and the old `['create_content','update_setting','mcp_call'].includes(a.type)`
   * compared those raw strings to that Enum instance — always false, so EVERY staged action the
   * model returned was silently discarded. `fromValue` yields `undefined` for an unknown type, which
   * also keeps garbage out; `resolve()` would have coerced it to CREATE_CONTENT.
   */
  private static _sanitizeActions(actions: any[]): IAssistantAction[] {
    return (Array.isArray(actions) ? actions : []).filter((a: any) => a && typeof a === 'object').map((a: any) => ({ type: AssistantActionType.fromValue(String(a?.type ?? '').trim()), collectionSlug: a.collectionSlug ? String(a.collectionSlug) : undefined, data: a.data && typeof a.data === 'object' ? a.data : undefined, key: a.key ? String(a.key) : undefined, value: a.value !== undefined ? String(a.value) : undefined, reason: a.reason ? String(a.reason) : undefined, tool: a.tool ? String(a.tool) : undefined, input: a.input && typeof a.input === 'object' ? a.input : undefined })).filter((a: any) => !!a.type) as IAssistantAction[];
  }
}
