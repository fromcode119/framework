/** Orchestrator intent handlers. Extracted from orchestrator.ts to reduce file size (AGENTS.md compliance). */

import type { AssistantAction, AssistantChatResult } from '../types';
import { ClarificationBuilder } from './clarification';
import { ActionBuilder } from './action-builder';
import { HomepagePlanner } from './planner';
import { RetrievalRunner } from './retrieval';
import type { RuntimeContext, RuntimeDependencies, RuntimeIntent } from './types.types';
import { ResponseBuilder } from './response';
import { OrchestratorActionUtils } from './orchestrator-action-utils';

const { chooseDraftTargetCollection, parseExplicitUpdateSelector, restrictActionsToAllowedTools, finalize, isFileReplaceAction, hasExplicitFileIntent, collectFileMatchPaths, asksForMatchLocations, collectTargetHintsFromRetrieval } = OrchestratorActionUtils;

export class OrchestratorHandlers {
  static async handleHomepageDraft(
    deps: RuntimeDependencies, context: RuntimeContext, intent: RuntimeIntent, message: string,
    selectedSkill: any, agentMode: 'basic' | 'advanced',
    traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>,
    planId: string,
  ): Promise<AssistantChatResult> {
    const scaffold = HomepagePlanner.buildHomepageDraftScaffold(message);
    const targetResolution = chooseDraftTargetCollection(message, context.collections);
    const explicitSelector = parseExplicitUpdateSelector(message);
    let actions: AssistantAction[] = [];
    let needsClarification = false;
    let clarifyingQuestion = '';
    let missingInputs: string[] = [];
    let checkpoint;

    if (targetResolution.status === 'resolved' && targetResolution.target) {
      const payload = HomepagePlanner.buildHomepagePayloadForCollection(targetResolution.target, scaffold);
      const hasExplicitTarget = explicitSelector.id !== undefined || !!explicitSelector.slug || !!explicitSelector.permalink;
      if (hasExplicitTarget) {
        actions.push({
          type: 'mcp_call', tool: 'content.update',
          input: {
            collectionSlug: targetResolution.target.slug,
            ...(explicitSelector.id !== undefined ? { id: explicitSelector.id } : {}),
            ...(explicitSelector.slug ? { slug: explicitSelector.slug } : {}),
            ...(explicitSelector.permalink ? { permalink: explicitSelector.permalink } : {}),
            data: payload,
          },
          reason: 'Stage homepage draft onto explicit target record.',
        });
      } else {
        actions.push({
          type: 'mcp_call', tool: 'content.create',
          input: { collectionSlug: targetResolution.target.slug, data: payload },
          reason: 'Stage homepage draft as a new record.',
        });
      }
    } else {
      needsClarification = true;
      const clarification = ClarificationBuilder.buildClarificationForDraft(targetResolution.candidates.map((item) => item.slug));
      clarifyingQuestion = clarification.question;
      missingInputs = clarification.missingInputs;
      checkpoint = ResponseBuilder.makeCheckpoint({
        reason: 'clarification_needed', resumePrompt: clarification.resumePrompt,
        stage: 'clarify', planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
      });
    }
    actions = restrictActionsToAllowedTools(actions, context);
    if (selectedSkill?.riskPolicy === 'read_only' && actions.length > 0) actions = [];
    const hasActions = actions.length > 0;
    const lead = selectedSkill?.riskPolicy === 'read_only'
      ? 'Here is a full homepage draft. Selected skill is read-only, so write actions were not staged.'
      : hasActions ? 'Here is a full homepage draft. Changes are ready for review.'
        : `Here is a full homepage draft. ${clarifyingQuestion || ''}`.trim();
    const text = [lead, '', scaffold.markdown].join('\n').trim();
    const ui = ResponseBuilder.buildUiHintsBase({ hasActions, selectedSkill, needsClarification, clarifyingQuestion, missingInputs, loopRecoveryMode: hasActions ? 'none' : 'best_effort' });
    return finalize(deps, { planId, goal: message, message: text, actions, model: 'deterministic-draft', ui, traces, selectedSkill, sessionId: context.input?.sessionId, checkpoint, agentMode });
  }

  static async handleReplaceText(
    deps: RuntimeDependencies,
    context: RuntimeContext,
    intent: RuntimeIntent,
    message: string,
    selectedSkill: any,
    agentMode: 'basic' | 'advanced',
    traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>,
    planId: string,
  ): Promise<AssistantChatResult> {
    const retrieval = await RetrievalRunner.runRetrieval(context, intent);
    traces.push({
      iteration: 2,
      phase: 'executor',
      message: `Retrieved evidence in ${retrieval.passes} pass(es) with ${retrieval.calls.length} tool call(s).`,
      toolCalls: retrieval.calls,
    });

    let actions = ActionBuilder.buildReplaceActions(intent, retrieval);
    actions = restrictActionsToAllowedTools(actions, context);
    if (selectedSkill?.riskPolicy === 'read_only' && actions.length > 0) {
      actions = [];
    }

    const evidence = ActionBuilder.summarizeReplaceEvidence(retrieval);
    const fileOnlyActions = actions.filter(isFileReplaceAction);
    const onlyFileActions = actions.length > 0 && fileOnlyActions.length === actions.length;
    const needsFileScopeClarification =
      onlyFileActions &&
      fileOnlyActions.length > 1 &&
      !hasExplicitFileIntent(message);

    if (needsFileScopeClarification) {
      const clarificationQuestion = [
        `I found ${fileOnlyActions.length} file matches for "${intent.replace?.from}" -> "${intent.replace?.to}", but these are source-file edits.`,
        'Do you want to update CMS/content values instead, or should I apply these file changes?',
      ].join(' ');
      const locationList = collectFileMatchPaths(fileOnlyActions, retrieval);
      const listPreview = locationList.slice(0, 5);
      const listOverflow = Math.max(0, locationList.length - listPreview.length);
      const includeLocations = asksForMatchLocations(message);
      const messageWithLocations = includeLocations && listPreview.length
        ? [
            'File matches:',
            ...listPreview.map((path) => `- ${path}`),
            ...(listOverflow > 0 ? [`- ...and ${listOverflow} more`] : []),
            '',
            clarificationQuestion,
          ].join('\n')
        : clarificationQuestion;
      const ui = ResponseBuilder.buildUiHintsBase({
        hasActions: false,
        selectedSkill,
        needsClarification: true,
        clarifyingQuestion: messageWithLocations,
        missingInputs: ['target_scope'],
        loopRecoveryMode: 'clarify',
      });
      return finalize(deps, {
        planId,
        goal: message,
        message: messageWithLocations,
        actions: [],
        model: 'deterministic-clarify',
        ui,
        traces,
        selectedSkill,
        sessionId: context.input?.sessionId,
        checkpoint: ResponseBuilder.makeCheckpoint({
          reason: 'clarification_needed',
          resumePrompt: 'Choose target scope: CMS/content records or source files.',
          stage: 'clarify',
          planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
        }),
        agentMode,
      });
    }

    if (actions.length > 0) {
      const ui = ResponseBuilder.buildUiHintsBase({ hasActions: true, selectedSkill });
      const msg =
        `Found ${evidence.totalMatches} match${evidence.totalMatches === 1 ? '' : 'es'} and staged ${actions.length} ` +
        `change${actions.length === 1 ? '' : 's'} for "${intent.replace?.from}" -> "${intent.replace?.to}".`;
      return finalize(deps, {
        planId,
        goal: message,
        message: msg,
        actions,
        model: 'deterministic-replace',
        ui,
        traces,
        selectedSkill,
        sessionId: context.input?.sessionId,
        agentMode,
      });
    }

    const foundTargetHints = collectTargetHintsFromRetrieval(retrieval);
    const clarification = ClarificationBuilder.buildClarificationForReplace({
      from: intent.replace?.from,
      to: intent.replace?.to,
      urlHint: intent.urlHint,
      foundTargetHints,
    });

    const needsClarification = true;
    const blockedMsg = retrieval.blockedTools.length
      ? `Some search tools are blocked in this run: ${retrieval.blockedTools.join(', ')}.`
      : '';
    const noMatchMsg = evidence.totalMatches === 0
      ? `No exact matches found yet for "${intent.replace?.from}".`
      : `Found ${evidence.totalMatches} candidate match${evidence.totalMatches === 1 ? '' : 'es'}, but none were safe to stage.`;
    const messageText = [blockedMsg, noMatchMsg, clarification.question].filter(Boolean).join(' ');
    const ui = ResponseBuilder.buildUiHintsBase({
      hasActions: false,
      selectedSkill,
      needsClarification,
      clarifyingQuestion: clarification.question,
      missingInputs: clarification.missingInputs,
      loopRecoveryMode: 'clarify',
    });

    return finalize(deps, {
      planId,
      goal: message,
      message: messageText,
      actions: [],
      model: 'deterministic-clarify',
      ui,
      traces,
      selectedSkill,
      sessionId: context.input?.sessionId,
      checkpoint: ResponseBuilder.makeCheckpoint({
        reason: 'clarification_needed',
        resumePrompt: clarification.resumePrompt,
        stage: 'clarify',
        planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
      }),
      agentMode,
    });
  }

  static async handleActionRequest(
    deps: RuntimeDependencies, context: RuntimeContext, intent: RuntimeIntent, message: string,
    selectedSkill: any, agentMode: 'basic' | 'advanced',
    traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<any, any> }> }>,
    planId: string,
  ): Promise<AssistantChatResult> {
    const retrievalIntent: RuntimeIntent = { kind: 'replace_text', confidence: Math.max(0.45, intent.confidence - 0.1), urlHint: intent.urlHint, queryHint: intent.urlHint };
    const retrieval = intent.urlHint ? await RetrievalRunner.runRetrieval(context, retrievalIntent) : null;
    if (retrieval) traces.push({ iteration: 2, phase: 'executor', message: `Retrieved target hints from URL/context in ${retrieval.passes} pass(es).`, toolCalls: retrieval.calls });
    const clarification = ClarificationBuilder.buildClarificationForReplace({ urlHint: intent.urlHint, foundTargetHints: retrieval ? collectTargetHintsFromRetrieval(retrieval) : [] });
    const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill, needsClarification: true, clarifyingQuestion: clarification.question, missingInputs: clarification.missingInputs, loopRecoveryMode: 'clarify' });
    return finalize(deps, {
      planId, goal: message, message: clarification.question, actions: [], model: 'deterministic-clarify', ui, traces, selectedSkill, sessionId: context.input?.sessionId,
      checkpoint: ResponseBuilder.makeCheckpoint({ reason: 'clarification_needed', resumePrompt: clarification.resumePrompt, stage: 'clarify', planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0) }),
      agentMode,
    });
  }
}

