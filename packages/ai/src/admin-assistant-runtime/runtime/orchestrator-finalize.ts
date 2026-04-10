/** Orchestrator finalize stage. Extracted from orchestrator.ts (ARC-007). */

import type { AssistantChatResult } from '../types';
import type { RuntimeContext, RuntimeDependencies, RuntimeIntent } from './types.types';
import { ResponseBuilder } from './response';
import { ChatResponder } from './chat-responder';
import { FactualQueryService } from './factual-query-service';
import { WorkspaceMapService } from './workspace-map';
import { OrchestratorActionUtils } from './orchestrator-action-utils';
import { OrchestratorListingUtils } from './orchestrator-listing-utils';

const { parseListingCollectionFromCheckpoint, parseListingCollectionFromHistory, getListingMemory, isRecordFollowupQuestion, collectCollectionFieldNames, resolveTargetRowIndex, resolveRequestedFieldHint, pickFieldFromRecord, fieldMatchesHint, extractRecordIdentity } = OrchestratorListingUtils;
const { finalize, findInventoryFollowupReply } = OrchestratorActionUtils;

export class OrchestratorFinalizeUtils {
  static async finalizeChatLike(
  deps: RuntimeDependencies,
  context: RuntimeContext,
  intent: RuntimeIntent,
  message: string,
  agentMode: 'basic' | 'advanced',
  traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>,
  planId: string,
): Promise<AssistantChatResult> {
  const listingCollectionSlug =
    parseListingCollectionFromCheckpoint(context.checkpoint) ||
    parseListingCollectionFromHistory(context.history);
  const listingMemory = getListingMemory(context.checkpoint);
  if (
    listingCollectionSlug &&
    isRecordFollowupQuestion(message) &&
    typeof context.options.listContent === 'function'
  ) {
    const collectionContext = context.collections.find((item) => {
      const slug = String(item?.slug || '').trim();
      const shortSlug = String(item?.shortSlug || '').trim();
      return slug === listingCollectionSlug || shortSlug === listingCollectionSlug;
    });
    if (collectionContext) {
      try {
        const listed = await context.options.listContent(collectionContext, {
          limit: 10,
          offset: 0,
          context: {},
        });
        const docs = Array.isArray(listed?.docs) ? listed.docs : [];
        const availableFields = collectCollectionFieldNames(collectionContext, docs);
        const targetIndex = resolveTargetRowIndex(message, docs, listingMemory);
        const record = docs[targetIndex] || docs[0] || null;
        const requestedField = resolveRequestedFieldHint(message, availableFields);
        const resolvedField =
          requestedField.field ||
          (!requestedField.query && listingMemory?.lastSelectedField
            ? String(listingMemory.lastSelectedField || '').trim()
            : '');
        const fieldHint = resolvedField || requestedField.query || '';
        const picked = pickFieldFromRecord(record, resolvedField, availableFields);
        const reply = !record
          ? `\`${collectionContext.slug}\` currently has no records to inspect.`
          : !picked
            ? `I found a record in \`${collectionContext.slug}\`, but it has no scalar fields I can read directly.`
            : requestedField.explicit && fieldHint && !fieldMatchesHint(picked.key, fieldHint)
              ? `I couldn't find a "${fieldHint}" field on that record. Closest available value is ${picked.key}: ${picked.value}`
              : `For \`${collectionContext.slug}\`, record ${targetIndex + 1} ${picked.key}: ${picked.value}`;
        const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill: context.selectedSkill });
        return finalize(deps, {
          planId,
          goal: message,
          message: reply,
          actions: [],
          model: 'workspace-list-followup',
          ui,
          traces,
          selectedSkill: context.selectedSkill,
          sessionId: context.input?.sessionId,
          checkpoint: ResponseBuilder.makeCheckpoint({
            reason: 'user_continue',
            resumePrompt: `Continue from ${collectionContext.slug} listing context.`,
            stage: 'finalize',
            planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
            memory: {
              listing: {
                collectionSlug: collectionContext.slug,
                lastSelectedRowIndex: targetIndex,
                lastSelectedRecordId: record ? extractRecordIdentity(record) || undefined : undefined,
                lastSelectedField: picked?.key || resolvedField || undefined,
              },
            },
          }),
          agentMode,
        });
      } catch {
        // Fall through to other handlers.
      }
    }
  }

  const collectionMatch = WorkspaceMapService.matchWorkspaceCollection(message, context.workspaceMap);
  const asksCollectionRecords =
    !!collectionMatch &&
    /\b(list|show|what|which)\b/i.test(String(message || '')) &&
    /\b(records?|entries|rows|docs?|data|items?|transactions?|orders?)\b/i.test(String(message || ''));
  if (collectionMatch && asksCollectionRecords && typeof context.options.listContent === 'function') {
    const collectionContext = context.collections.find((item) => {
      const slug = String(item?.slug || '').trim();
      const shortSlug = String(item?.shortSlug || '').trim();
      return slug === collectionMatch.slug || shortSlug === collectionMatch.slug || slug === collectionMatch.shortSlug;
    });
    if (collectionContext) {
      try {
        const listed = await context.options.listContent(collectionContext, {
          limit: 10,
          offset: 0,
          context: {},
        });
        const docs = Array.isArray(listed?.docs) ? listed.docs : [];
        const availableFields = collectCollectionFieldNames(collectionContext, docs);
        const totalDocs = Number.isFinite(Number((listed as any)?.totalDocs))
          ? Number((listed as any).totalDocs)
          : docs.length;
        const toLine = (doc: any, index: number): string => {
          const picked = pickFieldFromRecord(doc, '', availableFields);
          if (!picked) return `- Record ${index + 1}`;
          return `- ${picked.key}: ${picked.value}`;
        };
        const previewLines = docs.slice(0, 8).map(toLine);
        const reply = docs.length
          ? [
              `Found ${totalDocs} record${totalDocs === 1 ? '' : 's'} in \`${collectionContext.slug}\`.`,
              '',
              'Sample:',
              ...previewLines,
            ].join('\n')
          : `\`${collectionContext.slug}\` currently has no records.`;
        const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill: context.selectedSkill });
        const firstRow = docs[0] || null;
        const firstField = pickFieldFromRecord(firstRow, '', availableFields)?.key || undefined;
        return finalize(deps, {
          planId,
          goal: message,
          message: reply,
          actions: [],
          model: 'workspace-list',
          ui,
          traces,
          selectedSkill: context.selectedSkill,
          sessionId: context.input?.sessionId,
          checkpoint: ResponseBuilder.makeCheckpoint({
            reason: 'user_continue',
            resumePrompt: `Continue from ${collectionContext.slug} listing context.`,
            stage: 'finalize',
            planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
            memory: {
              listing: {
                collectionSlug: collectionContext.slug,
                lastSelectedRowIndex: 0,
                lastSelectedRecordId: firstRow ? extractRecordIdentity(firstRow) || undefined : undefined,
                lastSelectedField: firstField,
              },
            },
          }),
          agentMode,
        });
      } catch {
        // Fall through to non-listing inventory follow-up and model chat handling.
      }
    }
  }

  if (WorkspaceMapService.isWorkspaceInventoryRequest(message)) {
    const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill: context.selectedSkill });
    return finalize(deps, {
      planId,
      goal: message,
      message: WorkspaceMapService.buildWorkspaceInventoryMessage(context.workspaceMap),
      actions: [],
      model: 'workspace-map',
      ui,
      traces,
      selectedSkill: context.selectedSkill,
      sessionId: context.input?.sessionId,
      checkpoint: ResponseBuilder.makeCheckpoint({
        reason: 'user_continue',
        resumePrompt: 'Continue from workspace inventory context.',
        stage: 'finalize',
        planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
        memory: context.input?.checkpoint?.memory,
      }),
      agentMode,
    });
  }

  const inventoryFollowup = findInventoryFollowupReply(message, context);
  const factualCheckpointReply = inventoryFollowup || !context.checkpoint?.memory?.factual
    ? null
    : await FactualQueryService.resolveReply(context, message);
  const chatReply = inventoryFollowup || factualCheckpointReply
    ? null
    : await ChatResponder.generateChatReply(context, deps, intent, message, agentMode);
  const factualReply = inventoryFollowup || factualCheckpointReply || (chatReply && chatReply.source !== 'fallback')
    ? factualCheckpointReply
    : await FactualQueryService.resolveReply(context, message);
  const reply = inventoryFollowup
    ? { message: inventoryFollowup, model: 'inventory-followup' }
    : factualCheckpointReply
      ? factualCheckpointReply
      : chatReply && chatReply.source !== 'fallback'
      ? chatReply
      : factualReply
        ? factualReply
        : chatReply || await ChatResponder.generateChatReply(context, deps, intent, message, agentMode);

  const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill: context.selectedSkill });
  return finalize(deps, {
    planId,
    goal: message,
    message: reply.message,
    actions: [],
    model: reply.model,
    ui,
    traces,
    selectedSkill: context.selectedSkill,
    sessionId: context.input?.sessionId,
    checkpoint: ResponseBuilder.makeCheckpoint({
      reason: 'user_continue',
      resumePrompt: 'Continue the conversation naturally.',
      stage: 'finalize',
      planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
      memory: factualReply?.memory
        ? { factual: factualReply.memory }
        : context.input?.checkpoint?.memory,
    }),
    agentMode,
  });
  }
}
