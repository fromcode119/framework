import { AssistantActionType } from '@ai/admin-assistant-runtime/enums/assistant-action-type.enum';
import { ReplyIntent } from '@ai/admin-assistant-runtime/enums/reply-intent.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { TargetResolution } from '@ai/admin-assistant-runtime/enums/target-resolution.enum';
import { SettingsChangeKind } from '@ai/admin-assistant-runtime/enums/settings-change-kind.enum';
import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';
import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';
import type { IAssistantChatTrace } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-trace.interface';
import type { IAssistantCollectionContext } from '@ai/admin-assistant-runtime/interfaces/assistant-collection-context.interface';
import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';

import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';
import { AssistantCopyUtils } from '@ai/assistant-copy';

import { IntentClassifier } from '@ai/admin-assistant-runtime/intents';
import { McpBridgeBuilder } from '@ai/admin-assistant-runtime/helpers/mcp-bridge-builder';
import { ReplaceContentHelpers } from '@ai/admin-assistant-runtime/helpers/replace-content-helpers';
import { ReplyMessageBuilders } from '@ai/admin-assistant-runtime/helpers/reply-message-builders';
import { RuntimeMiscHelpers } from '@ai/admin-assistant-runtime/helpers/runtime-misc-helpers';
import { RuntimePlanHelpers } from '@ai/admin-assistant-runtime/helpers/runtime-plan-helpers';
import { ActionSafetyHelpers } from '@ai/admin-assistant-runtime/helpers/action-safety-helpers';
import { HomepageDraftHelpers } from '@ai/admin-assistant-runtime/helpers/homepage-draft-helpers';
import { ChatReplaceFlowHelpers } from '@ai/admin-assistant-runtime/helpers/chat-replace-flow';
import { ChatAgentLoopHelpers } from '@ai/admin-assistant-runtime/helpers/chat-agent-loop';

export class ChatRunner {
  static async run(input: IAssistantChatInput, options: IAdminAssistantRuntimeOptions): Promise<IAssistantChatResult> {
    const aiClient = options.aiClient;
    if (!aiClient || typeof aiClient.chat !== 'function') throw new Error('AI Assistant integration is not configured.');
    const message = String(input?.message || '').trim();
    if (!message) throw new Error('message is required');

    const availableSkills = RuntimeMiscHelpers.normalizeSkills(typeof options.resolveSkills === 'function' ? (await Promise.resolve(options.resolveSkills())) : RuntimeMiscHelpers.defaultSkillCatalog());
    const selectedSkillId = String(input?.skillId || 'general').trim().toLowerCase() || 'general';
    const selectedSkill = availableSkills.find((s) => s.id === selectedSkillId) || availableSkills.find((s) => s.id === 'general') || availableSkills[0];
    const requestedMode = String(input?.agentMode || '').trim().toLowerCase();
    const agentMode: ContextLevel = ['advanced', 'plan', 'agent'].includes(requestedMode) ? ContextLevel.ADVANCED : ['basic', 'chat', 'auto'].includes(requestedMode) ? ContextLevel.BASIC : String(selectedSkill?.defaultMode ?? 'chat') === 'chat' ? ContextLevel.BASIC : ContextLevel.ADVANCED;
    const maxIterations = Math.min(20, Math.max(1, Number(input?.maxIterations || 8)));
    const maxDurationMs = Math.min(120_000, Math.max(8_000, Number(input?.maxDurationMs || 35_000)));
    const sessionId = String(input?.sessionId || '').trim() || undefined;
    const planId = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const normalizedHistory: IAssistantMessage[] = (Array.isArray(input?.history) ? input.history : []).slice(-12).map((entry: any) => ({ role: AssistantRole.resolve(entry?.role ?? AssistantRole.USER.value), content: String(entry?.content || '').trim() })).filter((e) => !!e.content);

    const mcpBridge = await McpBridgeBuilder.build(options, true);
    const rawAvailableTools = mcpBridge.listTools();
    const allowedToolSet = Array.isArray(input?.allowedTools) && input.allowedTools.length ? new Set(input.allowedTools.map((i) => String(i || '').trim()).filter(Boolean)) : null;
    const skillToolSet = Array.isArray(selectedSkill?.allowedTools) && selectedSkill?.allowedTools?.length ? new Set((selectedSkill.allowedTools || []).map((i) => String(i || '').trim()).filter(Boolean)) : null;
    const isToolAllowed = (toolName: string) => { const name = String(toolName || '').trim(); if (!name) return false; if (allowedToolSet && !allowedToolSet.has(name)) return false; if (skillToolSet && !skillToolSet.has(name)) return false; return true; };
    const availableTools = rawAvailableTools.filter((tool) => isToolAllowed(String(tool.tool || '').trim()));

    let replaceInstruction = ReplaceContentHelpers.parseReplaceInstruction(message);
    let replaceFlowMessage = message;
    if (!replaceInstruction) { const continuation = ReplyMessageBuilders.deriveReplaceContinuation(message, normalizedHistory); if (continuation) { replaceInstruction = continuation.instruction; replaceFlowMessage = continuation.composedPrompt; } }
    const collections = options.getCollections();
    const plugins = typeof options.getPlugins === 'function' ? options.getPlugins() : [];
    const themes = typeof options.getThemes === 'function' ? options.getThemes() : [];
    const runtimeContextLines = RuntimeMiscHelpers.buildRuntimeContextLines(collections, plugins, themes, availableTools);
    const extensionPromptLinesRaw = await Promise.resolve(options.resolveAdditionalPromptLines?.({ collections, tools: availableTools }) || []);
    const normalizedExtensionPromptLines = Array.isArray(extensionPromptLinesRaw) ? extensionPromptLinesRaw.map((l: any) => String(l || '').trim()).filter(Boolean) : [];
    if (selectedSkill?.systemPromptPatch) normalizedExtensionPromptLines.push(`Skill profile (${selectedSkill.label}): ${selectedSkill.systemPromptPatch}`);
    const promptCopy = await Promise.resolve(options.resolvePromptCopy?.({ collections, plugins, tools: availableTools }) || {});
    const promptProfile = await Promise.resolve(options.resolvePromptProfile?.({ collections, plugins, tools: availableTools }) || {});
    const promptCopyBasic = Array.isArray((promptCopy as any)?.basic) ? (promptCopy as any).basic : undefined;
    const promptCopyAdvanced = Array.isArray((promptCopy as any)?.advanced) ? (promptCopy as any).advanced : undefined;
    const customBasicSystemPrompt = String((promptProfile as any)?.basicSystem || '').trim();
    const customAdvancedSystemPrompt = String((promptProfile as any)?.advancedSystem || '').trim();

    const buildUi = (opts: any) => RuntimePlanHelpers.buildUiHints({ ...opts, selectedSkill });
    const buildPlan = (opts: any) => RuntimePlanHelpers.buildPlanArtifact({ planId, goal: message, ...opts, selectedSkill, now: options.now || (() => new Date().toISOString()) });
    const sanitize = (msg: string, mode: ContextLevel) => RuntimeMiscHelpers.sanitizeUserFacingMessage(msg, mode);

    if (IntentClassifier.isCapabilityOverviewIntent(message)) {
      return { message: ReplyMessageBuilders.buildCapabilityOverviewMessage(collections, plugins, themes, availableTools), actions: [], model: '', agentMode: agentMode, done: true, traces: [], ui: buildUi({ hasActions: false, loopCapReached: false, loopTimeLimitReached: false, done: true }), skill: selectedSkill, sessionId, iterations: 1, loopCapReached: false };
    }
    if (IntentClassifier.isGreetingIntent(message) && normalizedHistory.length === 0) {
      return { message: sanitize(ReplyMessageBuilders.buildGreetingReply(), ContextLevel.BASIC), actions: [], model: '', agentMode: ContextLevel.BASIC, done: true, traces: [], ui: buildUi({ hasActions: false, loopCapReached: false, loopTimeLimitReached: false, done: true }), skill: selectedSkill, sessionId, iterations: 1, loopCapReached: false };
    }
    if (IntentClassifier.isVagueChangeIntent(message) && !replaceInstruction) {
      const clarification = ReplyMessageBuilders.buildClarificationRequest(ReplyIntent.GENERAL, []);
      return { message: sanitize(clarification.question, ContextLevel.ADVANCED), actions: [], model: '', agentMode: agentMode, done: true, traces: [], ui: buildUi({ hasActions: false, loopCapReached: false, loopTimeLimitReached: false, done: true, needsClarification: true, clarifyingQuestion: clarification.question, missingInputs: clarification.missingInputs, loopRecoveryMode: ClarifyMode.CLARIFY }), skill: selectedSkill, sessionId, iterations: 1, loopCapReached: false, checkpoint: { resumePrompt: clarification.resumePrompt, reason: CheckpointReason.CLARIFICATION_NEEDED, stage: RuntimeStage.CLARIFY, planningPassesUsed: Number(input?.checkpoint?.planningPassesUsed || 0) } };
    }

    if (IntentClassifier.isHomepageDraftIntent(message)) {
      const result = await ChatRunner._handleHomepageDraft(message, input, options, collections, availableTools, agentMode, selectedSkill, planId, sessionId, sanitize, buildPlan, buildUi);
      if (result) return result;
    }

    if (IntentClassifier.isStrategicAdviceIntent(message)) {
      const systemPrompt = [...runtimeContextLines, ...normalizedExtensionPromptLines, 'User is asking for high-level strategy and efficiency improvements.', 'Do not ask for collection/id/field unless the user explicitly asks to execute a concrete change.', 'Return concise, prioritized recommendations with clear next steps.', RuntimeMiscHelpers.buildDefaultBasicSystemPromptFromCopy(promptCopyBasic, customBasicSystemPrompt)].join('\n');
      const response = await aiClient.chat({ messages: [{ role: AssistantRole.SYSTEM, content: systemPrompt }, ...normalizedHistory, { role: AssistantRole.USER, content: message }], json: false, temperature: 0.25, maxTokens: 900 });
      const strategicMessage = sanitize(String(response?.content || '').trim() || ReplyMessageBuilders.buildStrategicAdviceFallbackMessage(collections, plugins, themes, availableTools), ContextLevel.BASIC);
      return { message: strategicMessage, actions: [], model: String(response?.model || ''), agentMode: ContextLevel.BASIC, done: true, traces: [], ui: { canContinue: false, requiresApproval: false, suggestedMode: AssistantRunMode.CHAT, showTechnicalDetailsDefault: false }, skill: selectedSkill, sessionId, iterations: 1, loopCapReached: false };
    }

    if (agentMode !== ContextLevel.ADVANCED) {
      const systemPrompt = [...runtimeContextLines, ...normalizedExtensionPromptLines, RuntimeMiscHelpers.buildDefaultBasicSystemPromptFromCopy(promptCopyBasic, customBasicSystemPrompt)].join('\n');
      const response = await aiClient.chat({ messages: [{ role: AssistantRole.SYSTEM, content: systemPrompt }, ...normalizedHistory, { role: AssistantRole.USER, content: message }], json: false, temperature: 0.25, maxTokens: 1200 });
      const basicMessage = sanitize(String(response?.content || '').trim() || 'No response generated.', ContextLevel.BASIC);
      return { message: basicMessage, actions: [], model: String(response?.model || ''), agentMode: ContextLevel.BASIC, done: true, traces: [], plan: buildPlan({ message: basicMessage, traces: [], actions: [], loopCapReached: false, loopTimeLimitReached: false, done: true }), ui: buildUi({ hasActions: false, loopCapReached: false, loopTimeLimitReached: false, done: true }), skill: selectedSkill, sessionId, iterations: 1, loopCapReached: false };
    }

    if (replaceInstruction) {
      return ChatReplaceFlowHelpers.handle(message, input, options, replaceInstruction, replaceFlowMessage, mcpBridge, availableTools, isToolAllowed, agentMode, selectedSkill, planId, sessionId, sanitize, buildPlan, buildUi);
    }

    const systemPrompt = [...runtimeContextLines, ...normalizedExtensionPromptLines, RuntimeMiscHelpers.buildDefaultAdvancedSystemPromptFromCopy(promptCopyAdvanced, customAdvancedSystemPrompt)].join('\n');
    return ChatAgentLoopHelpers.run(message, input, options, normalizedHistory, mcpBridge, availableTools, isToolAllowed, agentMode, maxIterations, maxDurationMs, selectedSkill, planId, sessionId, replaceInstruction, replaceFlowMessage, systemPrompt, sanitize, buildPlan, buildUi, aiClient);
  }

  private static async _handleHomepageDraft(message: string, input: IAssistantChatInput, options: IAdminAssistantRuntimeOptions, collections: IAssistantCollectionContext[], availableTools: IAssistantToolSummary[], agentMode: ContextLevel, selectedSkill: IAssistantSkillDefinition, planId: string, sessionId: string | undefined, sanitize: any, buildPlan: any, buildUi: any): Promise<IAssistantChatResult | null> {
    const scaffold = HomepageDraftHelpers.buildHomepageDraftScaffold(message);
    const explicitTarget = HomepageDraftHelpers.parseExplicitHomepageDraftTarget(message, collections);
    const collectionResolution = HomepageDraftHelpers.resolveHomepageDraftCollection(message, collections);
    let draftActions: IAssistantAction[] = [];
    let draftStageMode: SettingsChangeKind = SettingsChangeKind.NONE;
    let needsClarification = false; let clarifyingQuestion = ''; let missingInputs: string[] = []; let loopRecoveryMode: ClarifyMode = ClarifyMode.NONE; let checkpoint: IAssistantSessionCheckpoint | undefined;
    if (explicitTarget) {
      const col = options.findCollectionBySlug(explicitTarget.collectionSlug);
      if (col) {
        const payload = HomepageDraftHelpers.buildHomepageDraftPayloadForCollection(col, scaffold, options.now);
        draftActions = await ActionSafetyHelpers.filterUnsafeStagedActions([{ type: AssistantActionType.MCP_CALL, tool: 'content.update', input: { collectionSlug: explicitTarget.collectionSlug, ...explicitTarget.selector, data: payload }, reason: 'Stage homepage draft scaffold on explicitly targeted record.' }], availableTools, options);
        if (draftActions.length > 0) draftStageMode = SettingsChangeKind.UPDATE;
      }
    } else if (collectionResolution.status === TargetResolution.RESOLVED && collectionResolution.collectionSlug) {
      const col = options.findCollectionBySlug(collectionResolution.collectionSlug);
      if (col) {
        const payload = HomepageDraftHelpers.buildHomepageDraftPayloadForCollection(col, scaffold, options.now);
        draftActions = await ActionSafetyHelpers.filterUnsafeStagedActions([{ type: AssistantActionType.MCP_CALL, tool: 'content.create', input: { collectionSlug: col.slug, data: payload }, reason: 'Stage homepage draft scaffold as a separate draft record.' }], availableTools, options);
        if (draftActions.length > 0) draftStageMode = SettingsChangeKind.CREATE;
      }
    }
    if (selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.READ_ONLY) draftActions = [];
    let lead: string = AssistantCopyUtils.RUNTIME_COPY.bestEffortDraftReady;
    if (draftStageMode === SettingsChangeKind.CREATE) lead = 'Homepage draft is ready and staged as a new draft record. Live homepage stays untouched.';
    else if (draftStageMode === SettingsChangeKind.UPDATE) lead = 'Homepage draft is ready and staged on the explicitly targeted page.';
    if (!draftActions.length && selectedSkill?.riskPolicy !== AssistantSkillRiskPolicy.READ_ONLY) {
      const clarification = ReplyMessageBuilders.buildClarificationRequest(ReplyIntent.HOMEPAGE_DRAFT, collectionResolution.candidateCollections);
      needsClarification = true; clarifyingQuestion = clarification.question; missingInputs = clarification.missingInputs; loopRecoveryMode = ClarifyMode.BEST_EFFORT;
      checkpoint = { resumePrompt: clarification.resumePrompt, reason: CheckpointReason.CLARIFICATION_NEEDED, stage: RuntimeStage.CLARIFY, planningPassesUsed: Number(input?.checkpoint?.planningPassesUsed || 0) };
      lead = `${AssistantCopyUtils.RUNTIME_COPY.bestEffortDraftReady} ${clarification.question}`;
    }
    if (selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.READ_ONLY) lead = AssistantCopyUtils.RUNTIME_COPY.readOnlySkillBlocked;
    const draftMessage = sanitize([lead, '', scaffold.markdown].join('\n'), 'advanced');
    const traces: IAssistantChatTrace[] = [{ iteration: 1, phase: AgentRole.PLANNER, message: draftStageMode === SettingsChangeKind.CREATE ? 'Draft fast-path: generated homepage scaffold and staged content.create draft record.' : draftStageMode === SettingsChangeKind.UPDATE ? 'Draft fast-path: generated homepage scaffold and staged explicit content.update target.' : 'Draft fast-path: generated homepage scaffold and requested one missing detail for staging.', toolCalls: [] }];
    return { message: draftMessage, actions: draftActions, model: '', agentMode: agentMode, done: true, traces, plan: buildPlan({ message: draftMessage, traces, actions: draftActions, loopCapReached: false, loopTimeLimitReached: false, done: true }), ui: buildUi({ hasActions: draftActions.length > 0, loopCapReached: false, loopTimeLimitReached: false, done: true, needsClarification, clarifyingQuestion, missingInputs, loopRecoveryMode }), skill: selectedSkill, sessionId, checkpoint, iterations: 1, loopCapReached: false };
  }
}
