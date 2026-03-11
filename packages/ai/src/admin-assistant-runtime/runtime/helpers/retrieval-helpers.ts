import type { RuntimeContext, RuntimeIntent, RuntimeToolCall, RuntimeToolResult } from '../types.types';
import { RuntimeUtils } from '../types';

/**
 * Retrieval utilities for AI runtime
 * Handles tool filtering, query building, and confidence estimation
 */
export class RetrievalHelpers {
  /**
   * Extract tool names from runtime context
   * 
   * @param context - The runtime context containing tool definitions
   * @returns Set of available tool names
   * 
   * @example
   * const tools = RetrievalHelpers.toolSetFromContext(context);
   * const hasContentSearch = tools.has('content.search_text');
   */
  static toolSetFromContext(context: RuntimeContext): Set<string> {
    const set = new Set<string>();
    for (const tool of Array.isArray(context.tools) ? context.tools : []) {
      const name = String((tool as any)?.tool || '').trim();
      if (name) set.add(name);
    }
    return set;
  }

  /**
   * Filter tool calls by available and allowed tools
   * 
   * @param calls - Array of tool calls to filter
   * @param context - The runtime context
   * @returns Object with runnable calls and blocked tool names
   * 
   * @example
   * const result = RetrievalHelpers.withAllowedTools(calls, context);
   * result.runnable.forEach(call => execute(call));
   * console.log('Blocked:', result.blocked);
   */
  static withAllowedTools(
    calls: RuntimeToolCall[],
    context: RuntimeContext,
  ): { runnable: RuntimeToolCall[]; blocked: string[] } {
    const availableToolNames = RetrievalHelpers.toolSetFromContext(context);
    const allowedToolSet = context.allowedToolSet || new Set<string>();
    const runnable: RuntimeToolCall[] = [];
    const blocked: string[] = [];
    for (const call of calls) {
      const name = String(call.tool || '').trim();
      if (!name) continue;
      if (!availableToolNames.has(name) || (allowedToolSet.size > 0 && !allowedToolSet.has(name))) {
        blocked.push(name);
        continue;
      }
      runnable.push(call);
    }
    return { runnable, blocked };
  }

  /**
   * Build tool calls for replace text operation
   * 
   * @param intent - The runtime intent containing replace query
   * @returns Array of search tool calls
   * 
   * @example
   * const calls = RetrievalHelpers.buildReplaceCalls(intent);
   * // => [{ tool: 'content.search_text', input: { query: '...', ... } }, ...]
   */
  static buildReplaceCalls(intent: RuntimeIntent): RuntimeToolCall[] {
    const query = String(intent.replace?.from || intent.queryHint || '').trim();
    if (!query) return [];
    return [
      { tool: 'content.search_text', input: { query, maxMatches: 80 } },
      { tool: 'plugins.settings.search_text', input: { query, maxMatches: 80 } },
      { tool: 'plugins.files.search_text', input: { query, maxMatches: 80, maxFiles: 10000 } },
      { tool: 'themes.config.search_text', input: { query, maxMatches: 80 } },
      { tool: 'themes.files.search_text', input: { query, maxMatches: 80, maxFiles: 10000 } },
    ];
  }

  /**
   * Build tool calls for a specific query string
   * 
   * @param query - The search query
   * @returns Array of search tool calls
   * 
   * @example
   * const calls = RetrievalHelpers.buildReplaceCallsForQuery('homepage');
   * // => [{ tool: 'content.search_text', input: { query: 'homepage', ... } }, ...]
   */
  static buildReplaceCallsForQuery(query: string): RuntimeToolCall[] {
    const value = String(query || '').trim();
    if (!value) return [];
    return [
      { tool: 'content.search_text', input: { query: value, maxMatches: 60 } },
      { tool: 'plugins.settings.search_text', input: { query: value, maxMatches: 60 } },
      { tool: 'plugins.files.search_text', input: { query: value, maxMatches: 60, maxFiles: 6000 } },
      { tool: 'themes.config.search_text', input: { query: value, maxMatches: 60 } },
      { tool: 'themes.files.search_text', input: { query: value, maxMatches: 60, maxFiles: 6000 } },
    ];
  }

  /**
   * Extract last path segment from URL hint
   * 
   * @param urlHint - URL or path string
   * @returns Last path segment or undefined
   * 
   * @example
   * const hint = RetrievalHelpers.extractUrlQueryHint('https://example.com/preview/my-page');
   * // => "my-page"
   */
  static extractUrlQueryHint(urlHint: string): string | undefined {
    const raw = String(urlHint || '').trim();
    if (!raw) return undefined;
    try {
      const parsed = new URL(raw, raw.startsWith('http') ? undefined : 'http://localhost');
      const parts = parsed.pathname.split('/').map((part) => part.trim()).filter(Boolean);
      if (!parts.length) return undefined;
      return parts[parts.length - 1] || undefined;
    } catch {
      const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : undefined;
    }
  }

  /**
   * Build tool calls based on URL hint
   * 
   * @param intent - The runtime intent containing urlHint
   * @returns Array of search tool calls
   * 
   * @example
   * const calls = RetrievalHelpers.buildUrlHintCalls(intent);
   * // => [{ tool: 'content.search_text', input: { query: 'my-page', ... } }, ...]
   */
  static buildUrlHintCalls(intent: RuntimeIntent): RuntimeToolCall[] {
    const queryHint = RetrievalHelpers.extractUrlQueryHint(String(intent.urlHint || ''));
    if (!queryHint) return [];
    return [
      { tool: 'content.search_text', input: { query: queryHint, maxMatches: 40 } },
      { tool: 'themes.files.search_text', input: { query: queryHint, maxMatches: 40, maxFiles: 3000 } },
      { tool: 'plugins.files.search_text', input: { query: queryHint, maxMatches: 40, maxFiles: 3000 } },
    ];
  }

  /**
   * Count total matches across all tool results
   * 
   * @param results - Array of tool results
   * @returns Total number of matches
   * 
   * @example
   * const total = RetrievalHelpers.totalMatches(results);
   * console.log(`Found ${total} matches`);
   */
  static totalMatches(results: RuntimeToolResult[]): number {
    return results.reduce((acc, item) => acc + RuntimeUtils.listMatchesFromToolOutput(item.output || {}).length, 0);
  }

  /**
   * Derive refined search queries from intent
   * 
   * @param intent - The runtime intent
   * @returns Array of refined query strings
   * 
   * @example
   * const queries = RetrievalHelpers.deriveRefinedQueries(intent);
   * // => ['homepage', 'home', 'page']
   */
  static deriveRefinedQueries(intent: RuntimeIntent): string[] {
    const urlHint = String(intent.urlHint || '').trim();
    const from = String(intent.replace?.from || intent.queryHint || '').trim();
    const tokens = new Set<string>();
    if (from) tokens.add(from);

    const pathToken = RetrievalHelpers.extractUrlQueryHint(urlHint);
    if (pathToken) {
      tokens.add(pathToken);
      for (const part of pathToken.split(/[-_/]/g).map((item) => item.trim()).filter(Boolean)) {
        if (part.length >= 3) tokens.add(part);
      }
    }
    return Array.from(tokens).filter(Boolean);
  }

  /**
   * Estimate retrieval confidence based on matches and blocked tools
   * 
   * @param total - Total number ofmatches found
   * @param blockedCount - Number of blocked tools
   * @returns Confidence score between 0.05 and 0.99
   * 
   * @example
   * const confidence = RetrievalHelpers.estimateRetrievalConfidence(15, 0);
   * // => ~0.85 (high confidence)
   */
  static estimateRetrievalConfidence(total: number, blockedCount: number): number {
    const base = total > 0 ? Math.min(0.95, 0.52 + Math.log10(total + 1) * 0.33) : 0.24;
    const penalty = blockedCount > 0 ? Math.min(0.2, blockedCount * 0.03) : 0;
    return Math.max(0.05, Math.min(0.99, base - penalty));
  }
}
