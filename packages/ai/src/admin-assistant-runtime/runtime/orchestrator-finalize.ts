import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import { ResponderRoute } from '@ai/admin-assistant-runtime/enums/responder-route.enum';
import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
/** Orchestrator finalize stage. Extracted from orchestrator.ts (ARC-007). */

import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import type { IRuntimeDependencies } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-dependencies.interface';
import type { IRuntimeIntent } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-intent.interface';
import { ResponseBuilder } from '@ai/admin-assistant-runtime/runtime/response';
import { ChatResponder } from '@ai/admin-assistant-runtime/runtime/chat-responder';
import { FactualQueryService } from '@ai/admin-assistant-runtime/runtime/factual-query-service';
import { WorkspaceMapService } from '@ai/admin-assistant-runtime/runtime/workspace-map';
import { OrchestratorActionUtils } from '@ai/admin-assistant-runtime/runtime/orchestrator-action-utils';
import { OrchestratorListingUtils } from '@ai/admin-assistant-runtime/runtime/orchestrator-listing-utils';
import { AssistantRuntimeCapabilities } from '@ai/admin-assistant-runtime/assistant-runtime-capabilities';

export class OrchestratorFinalizeUtils {
  static async finalizeChatLike(
  deps: IRuntimeDependencies,
  context: IRuntimeContext,
  intent: IRuntimeIntent,
  message: string,
  agentMode: ContextLevel,
  traces: Array<{ iteration: number; message: string; phase?: AgentRole; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>,
  planId: string,
): Promise<IAssistantChatResult> {
  const listingCollectionSlug =
    OrchestratorListingUtils.parseListingCollectionFromCheckpoint(context.checkpoint) ||
    OrchestratorListingUtils.parseListingCollectionFromHistory(context.history);
  const listingMemory = OrchestratorListingUtils.getListingMemory(context.checkpoint);
  // Resolved BEFORE the follow-up check so its schema can answer "did the user name one of my fields?".
  const listingCollectionContext = listingCollectionSlug
    ? context.collections.find((item) => {
      const slug = String(item?.slug || '').trim();
      const shortSlug = String(item?.shortSlug || '').trim();
      return slug === listingCollectionSlug || shortSlug === listingCollectionSlug;
    })
    : undefined;
  if (
    listingCollectionSlug &&
    OrchestratorListingUtils.isRecordFollowupQuestion(
      message,
      OrchestratorListingUtils.collectCollectionFieldNames(listingCollectionContext, []),
    ) &&
    AssistantRuntimeCapabilities.canListContent(context.options)
  ) {
    const collectionContext = listingCollectionContext;
    if (collectionContext) {
      try {
        const listed = await AssistantRuntimeCapabilities.listContent(context.options, collectionContext, {
          limit: 10,
          offset: 0,
          context: {},
        });
        const docs = Array.isArray(listed?.docs) ? listed.docs : [];
        const availableFields = OrchestratorListingUtils.collectCollectionFieldNames(collectionContext, docs);
        const targetIndex = OrchestratorListingUtils.resolveTargetRowIndex(message, docs, listingMemory);
        const record = docs[targetIndex] || docs[0] || null;
        const requestedField = OrchestratorListingUtils.resolveRequestedFieldHint(message, availableFields);
        const resolvedField =
          requestedField.field ||
          (!requestedField.query && listingMemory?.lastSelectedField
            ? String(listingMemory.lastSelectedField || '').trim()
            : '');
        const fieldHint = resolvedField || requestedField.query || '';
        const picked = OrchestratorListingUtils.pickFieldFromRecord(record, resolvedField, availableFields);
        const reply = !record
          ? `\`${collectionContext.slug}\` currently has no records to inspect.`
          : !picked
            ? `I found a record in \`${collectionContext.slug}\`, but it has no scalar fields I can read directly.`
            : requestedField.explicit && fieldHint && !OrchestratorListingUtils.fieldMatchesHint(picked.key, fieldHint)
              ? `I couldn't find a "${fieldHint}" field on that record. Closest available value is ${picked.key}: ${picked.value}`
              : `For \`${collectionContext.slug}\`, record ${targetIndex + 1} ${picked.key}: ${picked.value}`;
        const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill: context.selectedSkill });
        return OrchestratorActionUtils.finalize(deps, {
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
            reason: CheckpointReason.USER_CONTINUE,
            resumePrompt: `Continue from ${collectionContext.slug} listing context.`,
            stage: RuntimeStage.FINALIZE,
            planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
            memory: {
              listing: {
                collectionSlug: collectionContext.slug,
                lastSelectedRowIndex: targetIndex,
                lastSelectedRecordId: record ? OrchestratorListingUtils.extractRecordIdentity(record) || undefined : undefined,
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
  // A generic record noun ("records", "rows", "entries") is SUFFICIENT but not necessary: the
  // collection's own name is a record noun too. `collectionMatch` is derived from this same message,
  // so a match already proves the user named the collection — demanding a second noun on top rejected
  // ordinary phrasing like "what users we have" and dropped it to the model.
  const asksCollectionRecords =
    !!collectionMatch &&
    /\b(list|show|what|which)\b/i.test(String(message || ''));
  if (collectionMatch && asksCollectionRecords && AssistantRuntimeCapabilities.canListContent(context.options)) {
    const collectionContext = context.collections.find((item) => {
      const slug = String(item?.slug || '').trim();
      const shortSlug = String(item?.shortSlug || '').trim();
      return slug === collectionMatch.slug || shortSlug === collectionMatch.slug || slug === collectionMatch.shortSlug;
    });
    if (collectionContext) {
      try {
        const listed = await AssistantRuntimeCapabilities.listContent(context.options, collectionContext, {
          limit: 10,
          offset: 0,
          context: {},
        });
        const docs = Array.isArray(listed?.docs) ? listed.docs : [];
        const availableFields = OrchestratorListingUtils.collectCollectionFieldNames(collectionContext, docs);
        const totalDocs = Number.isFinite(Number((listed as any)?.totalDocs))
          ? Number((listed as any).totalDocs)
          : docs.length;
        const toLine = (doc: any, index: number): string => {
          const picked = OrchestratorListingUtils.pickFieldFromRecord(doc, '', availableFields);
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
        const firstField = OrchestratorListingUtils.pickFieldFromRecord(firstRow, '', availableFields)?.key || undefined;
        return OrchestratorActionUtils.finalize(deps, {
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
            reason: CheckpointReason.USER_CONTINUE,
            resumePrompt: `Continue from ${collectionContext.slug} listing context.`,
            stage: RuntimeStage.FINALIZE,
            planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
            memory: {
              listing: {
                collectionSlug: collectionContext.slug,
                lastSelectedRowIndex: 0,
                lastSelectedRecordId: firstRow ? OrchestratorListingUtils.extractRecordIdentity(firstRow) || undefined : undefined,
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
    return OrchestratorActionUtils.finalize(deps, {
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
        reason: CheckpointReason.USER_CONTINUE,
        resumePrompt: 'Continue from workspace inventory context.',
        stage: RuntimeStage.FINALIZE,
        planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
        memory: context.input?.checkpoint?.memory,
      }),
      agentMode,
    });
  }

  // `WorkspaceMapService` already knows how to answer "what have I got?" and "tell me about `users`",
  // but `isWorkspaceInventoryRequest` / `buildWorkspaceInventoryMessage` / `findWorkspaceEntityReply`
  // had NO callers anywhere — only the two hand-rolled cases in `findInventoryFollowupReply` were
  // wired, so every other workspace question fell through to the model (and to "the AI model is
  // unavailable" when there was none). Checked after the listing branch above, so "list records"
  // phrasing still reaches the real listing path.
  const inventoryFollowup =
    OrchestratorActionUtils.findInventoryFollowupReply(message, context)
    || (WorkspaceMapService.isWorkspaceInventoryRequest(message)
      ? WorkspaceMapService.buildWorkspaceInventoryMessage(context.workspaceMap)
      : null)
    || WorkspaceMapService.findWorkspaceEntityReply(message, context.workspaceMap);
  // A checkpoint carrying `memory.factual` already HAS the numbers, so a model round-trip that comes
  // back with "could you clarify the period?" is strictly worse than answering — and it is a paid call
  // for a worse answer, so this runs BEFORE the model, not as a fallback after it. Gated on the memory
  // existing: with none, the model is still asked first and the service stays a fallback as before.
  const hasFactualMemory = !!(context.checkpoint as any)?.memory?.factual;
  const memoryReply = !inventoryFollowup && hasFactualMemory
    ? await FactualQueryService.resolveReply(context, message)
    : null;
  const chatReply = inventoryFollowup || memoryReply
    ? null
    : await ChatResponder.generateChatReply(context, deps, intent, message, agentMode);
  const modelAnswered = !!chatReply && chatReply.source !== ResponderRoute.FALLBACK;
  const factualReply = memoryReply
    ?? (inventoryFollowup || modelAnswered
      ? null
      : await FactualQueryService.resolveReply(context, message));
  const reply = inventoryFollowup
    ? { message: inventoryFollowup, model: 'inventory-followup' }
    : factualReply
      ? factualReply
      : modelAnswered
        ? chatReply
        : chatReply || await ChatResponder.generateChatReply(context, deps, intent, message, agentMode);

  const ui = ResponseBuilder.buildUiHintsBase({ hasActions: false, selectedSkill: context.selectedSkill });
  return OrchestratorActionUtils.finalize(deps, {
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
      reason: CheckpointReason.USER_CONTINUE,
      resumePrompt: 'Continue the conversation naturally.',
      stage: RuntimeStage.FINALIZE,
      planningPassesUsed: Number(context.input?.checkpoint?.planningPassesUsed || 0),
      memory: factualReply?.memory
        ? { factual: factualReply.memory }
        : context.input?.checkpoint?.memory,
    }),
    agentMode,
  });
  }
}
