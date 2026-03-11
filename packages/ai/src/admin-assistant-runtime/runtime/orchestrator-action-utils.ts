/** Orchestrator action utilities. Extracted from orchestrator.ts (ARC-007). */

import type { AssistantAction, AssistantChatResult, AssistantCollectionContext } from '../types';
import type { RuntimeContext, RuntimeDependencies, RuntimeRetrievalResult } from './types.types';
import { OrchestratorListingUtils } from './orchestrator-listing-utils';

/**
 * Utilities for orchestrator action building, filtering, and finalization.
 * All methods are static.
 */
export class OrchestratorActionUtils {
  /**
   * Normalize history array from chat input
   */
  static normalizeHistory(history: any): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    if (!Array.isArray(history)) return [];
    return history
      .filter((msg) => msg && typeof msg === 'object')
      .map((msg) => ({
        role: ['system', 'user', 'assistant'].includes(msg.role) ? msg.role : 'user',
        content: String(msg.content || '').trim(),
      }))
      .filter((msg) => msg.content);
  }

  /**
   * Choose draft target collection from message and available collections
   */
  static chooseDraftTargetCollection(
    message: string,
    collections: AssistantCollectionContext[],
  ): { status: 'resolved' | 'unresolved'; target: AssistantCollectionContext | null; candidates: AssistantCollectionContext[] } {
    const text = String(message || '').toLowerCase();
    const candidates = Array.isArray(collections) ? collections : [];
    
    // Look for explicit collection mention
    for (const collection of candidates) {
      const slug = String(collection.slug || '').toLowerCase();
      const shortSlug = String(collection.shortSlug || '').toLowerCase();
      const label = String(collection.label || '').toLowerCase();
      if (text.includes(slug) || text.includes(shortSlug) || text.includes(label)) {
        return { status: 'resolved', target: collection, candidates };
      }
    }

    // If only one candidate, auto-select it
    if (candidates.length === 1) {
      return { status: 'resolved', target: candidates[0], candidates };
    }

    return { status: 'unresolved', target: null, candidates };
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
  static restrictActionsToAllowedTools(actions: AssistantAction[], context: RuntimeContext): AssistantAction[] {
    if (!context.allowedToolSet || context.allowedToolSet.size === 0) return actions;
    
    return actions.filter((action) => {
      if (action.type !== 'mcp_call') return true;
      const tool = String(action.tool || '').trim();
      return !tool || context.allowedToolSet.has(tool);
    });
  }

  /**
   * Check if action is a file replace action
   */
  static isFileReplaceAction(action: AssistantAction): boolean {
    if (action.type !== 'mcp_call') return false;
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
  static collectFileMatchPaths(actions: AssistantAction[], retrieval: RuntimeRetrievalResult | null): string[] {
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
  static collectTargetHintsFromRetrieval(retrieval: RuntimeRetrievalResult): string[] {
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
  static findInventoryFollowupReply(message: string, context: RuntimeContext): string | null {
    const text = String(message || '').toLowerCase().trim();
    
    // Check for capability questions
    if (/\b(what can you|capabilities|what do you|help me)\b/.test(text)) {
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
    deps: RuntimeDependencies,
    options: {
      planId: string;
      goal: string;
      message: string;
      actions: AssistantAction[];
      model: string;
      ui: any;
      traces: any[];
      selectedSkill: any;
      sessionId?: string;
      checkpoint?: any;
      agentMode: 'basic' | 'advanced';
    },
  ): AssistantChatResult {
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
            state: 'staged',
            createdAt: Date.now(),
          }
        : undefined,
    };
  }
}
