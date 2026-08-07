import { AssistantActionType } from '@ai/admin-assistant-runtime/enums/assistant-action-type.enum';
import { ResolutionState } from '@ai/admin-assistant-runtime/enums/resolution-state.enum';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
/** Orchestrator action utilities. Extracted from orchestrator.ts (ARC-007). */

import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';
import type { IAssistantCollectionContext } from '@ai/admin-assistant-runtime/interfaces/assistant-collection-context.interface';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import type { IRuntimeDependencies } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-dependencies.interface';
import type { IRuntimeRetrievalResult } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-retrieval-result.interface';

/**
 * Utilities for orchestrator action building, filtering, and finalization.
 * All methods are static.
 */
export class OrchestratorActionUtils {
  /**
   * Normalize history array from chat input
   */
  static normalizeHistory(history: any): Array<{ role: AssistantRole; content: string }> {
    if (!Array.isArray(history)) return [];
    return history
      .filter((msg) => msg && typeof msg === 'object')
      .map((msg) => ({
        // `['system','user','assistant'].includes(msg.role)` compared raw strings against an
        // `AssistantRole` member, so it was ALWAYS false and every turn — including the assistant's —
        // was rewritten to the string 'user'. That erased the prior assistant message the classifier
        // reads to continue a clarification. `fromValue` accepts a member (via `toString`) or a wire
        // string; unknown still falls back to USER, as before.
        role: AssistantRole.fromValue(String(msg.role ?? '')) ?? AssistantRole.USER,
        content: String(msg.content || '').trim(),
      }))
      .filter((msg) => msg.content);
  }

  /**
   * Choose draft target collection from message and available collections
   */
  static chooseDraftTargetCollection(
    message: string,
    collections: IAssistantCollectionContext[],
  ): { status: ResolutionState; target: IAssistantCollectionContext | null; candidates: IAssistantCollectionContext[] } {
    const text = String(message || '').toLowerCase();
    const candidates = Array.isArray(collections) ? collections : [];
    
    // Look for explicit collection mention
    for (const collection of candidates) {
      const slug = String(collection.slug || '').toLowerCase();
      const shortSlug = String(collection.shortSlug || '').toLowerCase();
      const label = String(collection.label || '').toLowerCase();
      if (text.includes(slug) || text.includes(shortSlug) || text.includes(label)) {
        return { status: ResolutionState.RESOLVED, target: collection, candidates };
      }
    }

    // If only one candidate, auto-select it
    if (candidates.length === 1) {
      return { status: ResolutionState.RESOLVED, target: candidates[0], candidates };
    }

    return { status: ResolutionState.UNRESOLVED, target: null, candidates };
  }

  /**
   * Parse explicit update selector from message (id/slug/permalink)
   */
  static parseExplicitUpdateSelector(message: string): { id?: number; slug?: string; permalink?: string } {
    const text = String(message || '').trim();
    const result: { id?: number; slug?: string; permalink?: string } = {};

    // Look for id: pattern
    const idMatch = text.match(/\bid[=:]\s*(\d+)/i);
    if (idMatch) result.id = Number(idMatch[1]);

    // Look for slug: pattern
    const slugMatch = text.match(/\bslug[=:]\s*["']?([a-z0-9_-]+)["']?/i);
    if (slugMatch) result.slug = slugMatch[1];

    // Look for permalink: pattern
    const linkMatch = text.match(/\bpermalink[=:]\s*["']?([^"'\s]+)["']?/i);
    if (linkMatch) result.permalink = linkMatch[1];

    return result;
  }

  /**
   * Restrict actions to allowed tools based on context
   */
  static restrictActionsToAllowedTools(actions: IAssistantAction[], context: IRuntimeContext): IAssistantAction[] {
    if (!context.allowedToolSet || context.allowedToolSet.size === 0) return actions;
    
    return actions.filter((action) => {
      if (action.type !== AssistantActionType.MCP_CALL) return true;
      const tool = String(action.tool || '').trim();
      return !tool || context.allowedToolSet.has(tool);
    });
  }

  /**
   * Check if action is a file replace action
   */
  static isFileReplaceAction(action: IAssistantAction): boolean {
    if (action.type !== AssistantActionType.MCP_CALL) return false;
    const tool = String(action.tool || '');
    return tool.includes('files.replace_text') || tool === 'file_edit' || tool === 'replace_in_file';
  }

  /**
   * Check if message has explicit file intent
   */
  static hasExplicitFileIntent(message: string): boolean {
    const text = String(message || '').toLowerCase();
    return /\b(file|files|source|code|script|component)s?\b/.test(text) ||
           /\.(ts|tsx|js|jsx|css|scss|json|md|html|txt|xml|yaml|yml)\b/.test(text) ||
           text.includes('src/') || text.includes('app/') || text.includes('components/');
  }

  /**
   * Collect file paths from file actions and retrieval results
   */
  static collectFileMatchPaths(actions: IAssistantAction[], retrieval: IRuntimeRetrievalResult | null): string[] {
    const paths = new Set<string>();
    
    // From actions
    for (const action of actions) {
      if (OrchestratorActionUtils.isFileReplaceAction(action)) {
        const path = String((action.input as any)?.path || '').trim();
        if (path) paths.add(path);
      }
    }
    
    // From retrieval
    if (retrieval) {
      for (const result of retrieval.results) {
        const matches = Array.isArray((result.output as any)?.matches) ? (result.output as any).matches : [];
        for (const match of matches) {
          const path = String((match as any)?.path || '').trim();
          if (path) paths.add(path);
        }
      }
    }
    
    return Array.from(paths);
  }

  /**
   * Check if message asks for match locations
   */
  static asksForMatchLocations(message: string): boolean {
    const text = String(message || '').toLowerCase();
    return /\b(where|which files?|what files?|show (me )?files?|list files?|in which)\b/.test(text);
  }

  /**
   * Collect target hints from retrieval results
   */
  static collectTargetHintsFromRetrieval(retrieval: IRuntimeRetrievalResult): string[] {
    const hints = new Set<string>();
    
    for (const result of retrieval.results) {
      const matches = Array.isArray((result.output as any)?.matches) ? (result.output as any).matches : [];
      for (const match of matches) {
        const collection = String((match as any)?.collectionSlug || '').trim();
        const path = String((match as any)?.path || '').trim();
        const field = String((match as any)?.field || '').trim();
        
        if (collection) hints.add(collection);
        if (path) hints.add(path);
        if (collection && field) hints.add(`${collection}.${field}`);
      }
    }
    
    return Array.from(hints);
  }

  /**
   * Find inventory followup reply  
   */
  static findInventoryFollowupReply(message: string, context: IRuntimeContext): string | null {
    const text = String(message || '').toLowerCase().trim();
    
    // Check for capability questions. `what do you` must be `what do you do` — the bare prefix also
    // swallowed "what do you MEAN by cms content?", a clarification the classifier had already answered
    // precisely, and this canned blurb short-circuits `chatReply` below, so the specific answer lost to
    // the generic one.
    if (/\b(what can you|capabilities|what do you do|help me)\b/.test(text)) {
      return 'I can help you manage content, update settings, search your workspace, and more. Ask me to create, update, or find content in your collections.';
    }
    
    // Check for collection questions
    if (/\bhow many (collections?|content types?)\b/.test(text)) {
      const count = context.collections?.length || 0;
      return `You currently have ${count} collection${count === 1 ? '' : 's'} available.`;
    }
    
    return null;
  }

  /**
   * Finalize orchestrator result into AssistantChatResult
   */
  static finalize(
    deps: IRuntimeDependencies,
    options: {
      planId: string;
      goal: string;
      message: string;
      actions: IAssistantAction[];
      model: string;
      ui: any;
      traces: any[];
      selectedSkill: any;
      sessionId?: string;
      checkpoint?: any;
      agentMode: ContextLevel;
    },
  ): IAssistantChatResult {
    const hasActions = options.actions && options.actions.length > 0;
    
    return {
      message: options.message,
      actions: options.actions || [],
      model: options.model,
      agentMode: options.agentMode,
      done: true,
      traces: options.traces || [],
      ui: options.ui,
      skill: options.selectedSkill,
      sessionId: options.sessionId,
      checkpoint: options.checkpoint,
      actionBatch: hasActions
        ? {
            id: `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            state: BatchState.STAGED,
            createdAt: Date.now(),
          }
        : undefined,
    };
  }
}
