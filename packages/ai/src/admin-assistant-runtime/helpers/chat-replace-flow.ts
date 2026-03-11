import type { McpBridge } from '@fromcode119/mcp';
import type { AssistantAction, AssistantChatInput, AssistantChatResult, AssistantChatTrace, AssistantSkillDefinition, AssistantToolSummary, AdminAssistantRuntimeOptions } from '../types';
import { AssistantCopyUtils } from '../../assistant-copy';
import { ReplaceContentHelpers } from './replace-content-helpers';
import { ActionSafetyHelpers } from './action-safety-helpers';
import { RuntimeMiscHelpers } from './runtime-misc-helpers';
import { IntentClassifier } from '../intents';
import { ReplyMessageBuilders } from './reply-message-builders';

export class ChatReplaceFlowHelpers {
  static async handle(
    message: string, input: AssistantChatInput, options: AdminAssistantRuntimeOptions,
    replaceInstruction: { from: string; to: string }, replaceFlowMessage: string,
    mcpBridge: McpBridge, availableTools: AssistantToolSummary[], isToolAllowed: (t: string) => boolean,
    agentMode: string, selectedSkill: AssistantSkillDefinition, planId: string, sessionId: string | undefined,
    sanitize: (msg: string, mode: 'basic' | 'advanced') => string, buildPlan: (opts: any) => any, buildUi: (opts: any) => any,
  ): Promise<AssistantChatResult> {
    const FILE_MAX = 10_000;
    const FILE_TOOLS = new Set<string>(['plugins.files.search_text', 'themes.files.search_text']);
    const runSearchCalls = async (calls: Array<{ tool: string; input: Record<string, any> }>) => {
      const results: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
      for (const call of calls) {
        if (!isToolAllowed(call.tool)) { results.push({ tool: call.tool, input: { ...call.input }, result: { ok: false, error: `Tool "${call.tool}" is not enabled for this run.` } }); continue; }
        try { results.push({ tool: call.tool, input: { ...call.input }, result: await mcpBridge.call({ tool: call.tool, input: { ...call.input }, context: { dryRun: true } }) }); }
        catch (error: any) { results.push({ tool: call.tool, input: { ...call.input }, result: { ok: false, error: String(error?.message || `Tool "${call.tool}" failed.`) } }); }
      }
      return results;
    };
    const deterministicCalls = [
      { tool: 'content.search_text', input: { query: replaceInstruction.from, maxMatches: 80 } },
      { tool: 'plugins.settings.search_text', input: { query: replaceInstruction.from, maxMatches: 80 } },
      { tool: 'plugins.files.search_text', input: { query: replaceInstruction.from, maxMatches: 80, maxFiles: FILE_MAX } },
      { tool: 'themes.config.search_text', input: { query: replaceInstruction.from, maxMatches: 80 } },
      { tool: 'themes.files.search_text', input: { query: replaceInstruction.from, maxMatches: 80, maxFiles: FILE_MAX } },
    ];
    const deterministicResults = await runSearchCalls(deterministicCalls);
    const blockedSearchTools = deterministicResults.filter((i) => !i?.result?.ok && /not enabled for this run/.test(String(i?.result?.error || ''))).map((i) => String(i?.tool || '')).filter((t) => t.endsWith('.search_text'));
    const fileSearchTruncated = deterministicResults.some((i) => FILE_TOOLS.has(String(i?.tool || '')) && i?.result?.ok === true && (i?.result?.output as any)?.truncated === true);

    let deterministicActions = await ReplaceContentHelpers.stageFallbackReplaceActions(replaceFlowMessage, deterministicResults, mcpBridge, options);
    if (deterministicActions.length) {
      deterministicActions = await ActionSafetyHelpers.filterUnsafeStagedActions(deterministicActions, availableTools, options);
      if (deterministicActions.length) deterministicActions = ReplaceContentHelpers.filterReplaceActionsByEvidence(deterministicActions, replaceInstruction, deterministicResults);
    }

    const fileReplaceActions = deterministicActions.filter((a) => a.type === 'mcp_call' && ['plugins.files.replace_text', 'themes.files.replace_text'].includes(String(a.tool || '')));
    if (deterministicActions.length > 0 && fileReplaceActions.length === deterministicActions.length && fileReplaceActions.length > 1 && !IntentClassifier.isExplicitFileModificationIntent(message)) {
      const q = sanitize([`I found ${fileReplaceActions.length} source-file matches for "${replaceInstruction.from}" -> "${replaceInstruction.to}".`, 'Do you want to update CMS/content values instead, or should I apply these file changes?'].join(' '), 'advanced');
      const traces: AssistantChatTrace[] = [{ iteration: 1, message: 'Deterministic replace found multiple file-only matches; requested target scope clarification.', phase: 'planner', toolCalls: deterministicCalls }];
      return { message: q, actions: [], model: '', agentMode: 'advanced', done: true, traces, plan: buildPlan({ message: q, traces, actions: [], loopCapReached: false, loopTimeLimitReached: false, done: true }), ui: buildUi({ hasActions: false, loopCapReached: false, loopTimeLimitReached: false, done: true, needsClarification: true, clarifyingQuestion: q, missingInputs: ['target_scope'], loopRecoveryMode: 'clarify' }), skill: selectedSkill, sessionId, checkpoint: { resumePrompt: 'Choose target scope: CMS/content records or source files.', reason: 'clarification_needed', stage: 'clarify', planningPassesUsed: Number(input?.checkpoint?.planningPassesUsed || 0) }, iterations: 1, loopCapReached: false };
    }

    const deterministicStats = RuntimeMiscHelpers.toolMatchStatsByTool(deterministicResults);
    const totalExactMatches = ['content.search_text', 'plugins.settings.search_text', 'plugins.files.search_text', 'themes.config.search_text', 'themes.files.search_text'].reduce((sum, t) => sum + Number(deterministicStats.get(t) || 0), 0);
    let targetTextMatches = 0; let broadContentMatches = 0; let broadPluginMatches = 0; let broadPluginFileMatches = 0; let broadThemeMatches = 0; let broadThemeFileMatches = 0;
    const deterministicSummary = ReplyMessageBuilders.buildToolResultsFallbackMessage(deterministicResults, '', RuntimeMiscHelpers.formatToolLabel);

    if (!deterministicActions.length && totalExactMatches === 0) {
      const targetCalls = [{ tool: 'content.search_text', input: { query: replaceInstruction.to, maxMatches: 80 } }, { tool: 'plugins.settings.search_text', input: { query: replaceInstruction.to, maxMatches: 80 } }, { tool: 'plugins.files.search_text', input: { query: replaceInstruction.to, maxMatches: 80, maxFiles: FILE_MAX } }, { tool: 'themes.config.search_text', input: { query: replaceInstruction.to, maxMatches: 80 } }, { tool: 'themes.files.search_text', input: { query: replaceInstruction.to, maxMatches: 80, maxFiles: FILE_MAX } }];
      const targetResults = await runSearchCalls(targetCalls);
      const targetStats = RuntimeMiscHelpers.toolMatchStatsByTool(targetResults);
      targetTextMatches = ['content.search_text', 'plugins.settings.search_text', 'plugins.files.search_text', 'themes.config.search_text', 'themes.files.search_text'].reduce((sum, t) => sum + Number(targetStats.get(t) || 0), 0);
      if (!targetTextMatches) {
        const broadQuery = ReplaceContentHelpers.buildSharedReplaceSearchQuery(replaceInstruction.from, replaceInstruction.to);
        if (broadQuery) {
          const broadStats = RuntimeMiscHelpers.toolMatchStatsByTool(await runSearchCalls([{ tool: 'content.search_text', input: { query: broadQuery, maxMatches: 80 } }, { tool: 'plugins.settings.search_text', input: { query: broadQuery, maxMatches: 80 } }, { tool: 'plugins.files.search_text', input: { query: broadQuery, maxMatches: 80, maxFiles: FILE_MAX } }, { tool: 'themes.config.search_text', input: { query: broadQuery, maxMatches: 80 } }, { tool: 'themes.files.search_text', input: { query: broadQuery, maxMatches: 80, maxFiles: FILE_MAX } }]));
          broadContentMatches = Number(broadStats.get('content.search_text') || 0); broadPluginMatches = Number(broadStats.get('plugins.settings.search_text') || 0); broadPluginFileMatches = Number(broadStats.get('plugins.files.search_text') || 0); broadThemeMatches = Number(broadStats.get('themes.config.search_text') || 0); broadThemeFileMatches = Number(broadStats.get('themes.files.search_text') || 0);
        }
      }
    }

    const deterministicMessage = AssistantCopyUtils.buildDeterministicReplaceMessage({ from: replaceInstruction.from, to: replaceInstruction.to, actionCount: deterministicActions.length, totalExactMatches, targetTextMatches, broadContentMatches, broadPluginMatches: broadPluginMatches + broadPluginFileMatches, broadThemeMatches: broadThemeMatches + broadThemeFileMatches, fallbackSummary: deterministicSummary, blockedSearchTools, fileSearchTruncated });
    const deterministicText = sanitize(RuntimeMiscHelpers.normalizePlanModeMessage(deterministicMessage, 'advanced', deterministicActions.length > 0, true), 'advanced');
    const deterministicTraces: AssistantChatTrace[] = [{ iteration: 1, message: AssistantCopyUtils.buildDeterministicTraceMessage(deterministicActions.length > 0), phase: 'planner', toolCalls: deterministicCalls }];
    return { message: deterministicText, actions: deterministicActions, model: '', agentMode: 'advanced', done: true, traces: deterministicTraces, plan: buildPlan({ message: deterministicText, traces: deterministicTraces, actions: deterministicActions, loopCapReached: false, loopTimeLimitReached: false, done: true }), ui: buildUi({ hasActions: deterministicActions.length > 0, loopCapReached: false, loopTimeLimitReached: false, done: true }), skill: selectedSkill, sessionId, iterations: 1, loopCapReached: false };
  }
}
