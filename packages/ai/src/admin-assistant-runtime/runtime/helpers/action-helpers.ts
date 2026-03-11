import type { AssistantAction } from '../../types';
import { RuntimeUtils } from '../types';
import type { RuntimeRetrievalResult } from '../types.types';
import { TextHelpers } from './text-helpers';

/**
 * Action building utilities for AI runtime
 * Handles text replacement logic and action staging
 */
export class ActionHelpers {
  /**
   * Replace text in a string case-insensitively
   * 
   * @param value - The source string
   * @param from - The text to find
   * @param to - The replacement text
   * @returns String with replacements applied
   * 
   * @example
   * const result = ActionHelpers.replaceTextInsensitive('Hello World', 'world', 'Universe');
   * // => "Hello Universe"
   */
  static replaceTextInsensitive(value: string, from: string, to: string): string {
    const source = String(value || '');
    const fromText = String(from || '').trim();
    const toText = String(to || '');
    if (!fromText) return source;
    const pattern = new RegExp(TextHelpers.escapeRegExp(fromText), 'gi');
    return source.replace(pattern, toText);
  }

  /**
   * Replace text in value if it changed, otherwise return null
   * 
   * @param value - The value to check and replace
   * @param from - The text to find
   * @param to - The replacement text
   * @returns Replaced string if changed, null otherwise
   * 
   * @example
   * const result = ActionHelpers.replaceIfChanged('test value', 'value', 'data');
   * // => "test data"
   * const noChange = ActionHelpers.replaceIfChanged('test', 'missing', 'x');
   * // => null
   */
  static replaceIfChanged(value: any, from: string, to: string): string | null {
    if (typeof value !== 'string') return null;
    const next = ActionHelpers.replaceTextInsensitive(value, from, to);
    return next !== value ? next : null;
  }

  /**
   * Collect retrieval matches grouped by tool name
   * 
   * @param retrieval - The retrieval result containing tool outputs
   * @returns Map of tool names to match arrays
   * 
   * @example
   * const grouped = ActionHelpers.collectMatchesByTool(retrieval);
   * const contentMatches = grouped.get('content.search_text') || [];
   */
  static collectMatchesByTool(retrieval: RuntimeRetrievalResult): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    for (const item of retrieval.results) {
      const matches = RuntimeUtils.listMatchesFromToolOutput(item.output || {});
      if (!matches.length) continue;
      grouped.set(item.tool, matches);
    }
    return grouped;
  }

  /**
   * Stage content update actions from matches
   * 
   * @param matches - Array of content matches
   * @param from - Text to find
   * @param to - Replacement text
   * @returns Array of content.update actions
   * 
   * @example
   * const actions = ActionHelpers.stageContentUpdates(matches, 'old', 'new');
   * // => [{ type: 'mcp_call', tool: 'content.update', ... }]
   */
  static stageContentUpdates(matches: any[], from: string, to: string): AssistantAction[] {
    const actions: AssistantAction[] = [];
    const seen = new Set<string>();
    for (const match of matches) {
      const collectionSlug = String((match as any)?.collectionSlug || '').trim();
      const recordId = (match as any)?.recordId;
      const field = String((match as any)?.field || '').trim();
      const value = (match as any)?.value;
      if (!collectionSlug || recordId === undefined || recordId === null || !field) continue;
      const replaced = ActionHelpers.replaceIfChanged(value, from, to);
      if (replaced === null) continue;
      const dedupeKey = `${collectionSlug}:${String(recordId)}:${field}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      actions.push({
        type: 'mcp_call',
        tool: 'content.update',
        input: {
          collectionSlug,
          id: recordId,
          data: {
            [field]: replaced,
          },
        },
        reason: `Replace "${from}" with "${to}" in ${collectionSlug}.${field}`,
      });
    }
    return actions;
  }

  /**
   * Stage plugin/theme config update actions from matches
   * 
   * @param tool - The update tool name (plugins.settings.update or themes.config.update)
   * @param matches - Array of config matches
   * @param from - Text to find
   * @param to - Replacement text
   * @returns Array of config update actions
   * 
   * @example
   * const actions = ActionHelpers.stageConfigUpdates('plugins.settings.update', matches, 'old', 'new');
   */
  static stageConfigUpdates(
    tool: 'plugins.settings.update' | 'themes.config.update',
    matches: any[],
    from: string,
    to: string,
  ): AssistantAction[] {
    const actions: AssistantAction[] = [];
    const grouped = new Map<string, Record<string, any>>();
    for (const match of matches) {
      const slug = String((match as any)?.slug || '').trim();
      const path = String((match as any)?.path || '').trim();
      const value = (match as any)?.value;
      if (!slug || !path) continue;
      const replaced = ActionHelpers.replaceIfChanged(value, from, to);
      if (replaced === null) continue;
      const bucket = grouped.get(slug) || {};
      bucket[path] = replaced;
      grouped.set(slug, bucket);
    }

    for (const [slug, data] of grouped.entries()) {
      actions.push({
        type: 'mcp_call',
        tool,
        input: { slug, data, merge: true },
        reason: `Replace "${from}" with "${to}" in ${slug} configuration`,
      });
    }

    return actions;
  }

  /**
   * Stage file update actions from file matches
   * 
   * @param tool - The file update tool (plugins.files.replace_text or themes.files.replace_text)
   * @param matches - Array of file matches
   * @param from - Text to find
   * @param to - Replacement text
   * @returns Array of file replace actions
   * 
   * @example
   * const actions = ActionHelpers.stageFileUpdates('themes.files.replace_text', matches, 'old', 'new');
   */
  static stageFileUpdates(
    tool: 'plugins.files.replace_text' | 'themes.files.replace_text',
    matches: any[],
    from: string,
    to: string,
  ): AssistantAction[] {
    const actions: AssistantAction[] = [];
    const seen = new Set<string>();
    for (const match of matches) {
      const slug = String((match as any)?.slug || '').trim();
      const path = String((match as any)?.path || '').trim();
      const value = (match as any)?.value;
      if (!path) continue;
      if (typeof value === 'string' && !value.toLowerCase().includes(String(from || '').toLowerCase())) {
        continue;
      }
      const key = `${slug}:${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push({
        type: 'mcp_call',
        tool,
        input: {
          slug: slug || undefined,
          path,
          from,
          to,
          caseSensitive: false,
        },
        reason: `Replace "${from}" with "${to}" in file ${path}`,
      });
    }
    return actions;
  }
}
