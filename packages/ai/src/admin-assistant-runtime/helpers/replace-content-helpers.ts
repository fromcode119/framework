import type { McpBridge } from '@fromcode119/mcp';
import type { AssistantAction, AdminAssistantRuntimeOptions } from '../types';
import { SearchTextHelpers } from './search-text-helpers';
import { PathObjectHelpers } from './path-object-helpers';
import { IntentClassifier } from '../intents';
import { AssistantConstants } from '../constants';

/** Replace/content operation helpers extracted from AdminAssistantRuntime. */
export class ReplaceContentHelpers {
  static isInternalTarget(collectionSlug: string, recordId: any): boolean {
    const col = String(collectionSlug || '').trim().toLowerCase();
    if (col !== 'settings') return false;
    return String(recordId ?? '').trim().toLowerCase().startsWith(AssistantConstants.INTERNAL_ASSISTANT_SESSION_KEY_PREFIX);
  }

  static parseReplaceInstruction(prompt: string): { from: string; to: string } | null {
    const sourceRaw = String(prompt || '').trim();
    if (!sourceRaw) return null;
    const source = sourceRaw.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const patterns: RegExp[] = [
      /(?:change|replace|update|set)[^%\n]{0,120}([+-]?\d+(?:\.\d+)?%)\b[\s\S]{0,80}?\bto\b\s*([+-]?\d+(?:\.\d+)?%)\b/i,
      /([+-]?\d+(?:\.\d+)?%)\s*(?:->|to)\s*([+-]?\d+(?:\.\d+)?%)\b/i,
      /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
      /update\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /chage\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /(?:change|chage|replace|update|rename|swap|substitute|find\s+and\s+replace)[^"'\n]{0,120}["']([^"']+)["']\s+(?:with|to)\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s*->\s*["']([^"']+)["']/i,
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      const from = String(match?.[1] || '').trim();
      const to = String(match?.[2] || '').trim();
      if (from && to && from.toLowerCase() !== to.toLowerCase()) return { from, to };
    }
    const unquotedPatterns: RegExp[] = [
      /^(?:can you|could you|would you|please)\s+(?:change|chage|replace|update|rename|swap|substitute|find\s+and\s+replace)\s+(.+?)\s+(?:with|to)\s+(.+?)\s*$/i,
      /^(?:change|chage|replace|update|rename|swap|substitute|find\s+and\s+replace)\s+(.+?)\s+(?:with|to)\s+["']([^"']+)["']\s*$/i,
      /^(?:change|chage|replace|update|rename|swap|substitute|find\s+and\s+replace)\s+["']([^"']+)["']\s+(?:with|to)\s+(.+?)\s*$/i,
      /^(?:change|chage|replace|update|rename|swap|substitute|find\s+and\s+replace)\s+(.+?)\s+(?:with|to)\s+(.+?)\s*$/i,
      /^from\s+(.+?)\s+to\s+(.+?)\s*$/i,
    ];
    const normalizeEdgeQuotes = (v: string) => String(v || '').trim().replace(/^["'""'']+/, '').replace(/["'""'']+$/, '').trim();
    for (const pattern of unquotedPatterns) {
      const match = source.match(pattern);
      const from = normalizeEdgeQuotes(String(match?.[1] || ''));
      const to = normalizeEdgeQuotes(String(match?.[2] || ''));
      if (!from || !to || from.toLowerCase() === to.toLowerCase()) continue;
      return { from, to };
    }
    return null;
  }

  static buildSharedReplaceSearchQuery(fromText: string, toText: string): string {
    const stop = new Set(['the', 'a', 'an', 'for', 'with', 'to', 'from', 'of', 'in', 'on', 'and', 'or', 'by']);
    const fromTokens = SearchTextHelpers.tokenizeSearchQuery(String(fromText || '')).filter((t) => !stop.has(t));
    const toTokenSet = new Set(SearchTextHelpers.tokenizeSearchQuery(String(toText || '')).filter((t) => !stop.has(t)));
    const shared: string[] = [];
    for (const token of fromTokens) { if (toTokenSet.has(token) && !shared.includes(token)) shared.push(token); }
    if (!shared.length) return '';
    return shared.slice(0, 6).join(' ').trim();
  }

  static collectContentSearchMatches(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
  ): Array<{ collectionSlug: string; recordId: string | number; field: string; value: string }> {
    const matches: Array<{ collectionSlug: string; recordId: string | number; field: string; value: string }> = [];
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      if (String(item?.tool || '') !== 'content.search_text') continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      for (const entry of Array.isArray((output as any).matches) ? (output as any).matches : []) {
        const collectionSlug = String((entry as any)?.collectionSlug || '').trim();
        const field = String((entry as any)?.field || '').trim();
        const value = String((entry as any)?.value || '');
        const recordId = (entry as any)?.recordId;
        if (!collectionSlug || !field) continue;
        if (recordId === undefined || recordId === null || String(recordId).trim() === '') continue;
        matches.push({ collectionSlug, recordId, field, value });
      }
    }
    return matches;
  }

  static collectConfigSearchMatches(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    toolName: 'plugins.settings.search_text' | 'themes.config.search_text',
  ): Array<{ slug: string; path: string; value: string }> {
    const matches: Array<{ slug: string; path: string; value: string }> = [];
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      if (String(item?.tool || '') !== toolName) continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      for (const entry of Array.isArray((output as any).matches) ? (output as any).matches : []) {
        const slug = String((entry as any)?.slug || '').trim();
        const path = String((entry as any)?.path || '').trim();
        if (!slug || !path) continue;
        matches.push({ slug, path, value: String((entry as any)?.value || '') });
      }
    }
    return matches;
  }

  static collectScopedFileSearchMatches(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    toolName: 'plugins.files.search_text' | 'themes.files.search_text',
  ): Array<{ slug: string; path: string; value: string }> {
    const matches: Array<{ slug: string; path: string; value: string }> = [];
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      if (String(item?.tool || '') !== toolName) continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      for (const entry of Array.isArray((output as any).matches) ? (output as any).matches : []) {
        const slug = String((entry as any)?.slug || '').trim();
        const pathValue = String((entry as any)?.path || '').trim();
        if (!slug || !pathValue) continue;
        matches.push({ slug, path: pathValue, value: String((entry as any)?.value || '') });
      }
    }
    return matches;
  }

  static filterReplaceActionsByEvidence(
    actions: AssistantAction[],
    replaceInstruction: { from: string; to: string },
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
  ): AssistantAction[] {
    const pluginMatches = ReplaceContentHelpers.collectConfigSearchMatches(toolResults, 'plugins.settings.search_text');
    const themeMatches = ReplaceContentHelpers.collectConfigSearchMatches(toolResults, 'themes.config.search_text');
    const pluginFileMatches = ReplaceContentHelpers.collectScopedFileSearchMatches(toolResults, 'plugins.files.search_text');
    const themeFileMatches = ReplaceContentHelpers.collectScopedFileSearchMatches(toolResults, 'themes.files.search_text');
    const contentMatches = ReplaceContentHelpers.collectContentSearchMatches(toolResults);
    return (Array.isArray(actions) ? actions : []).filter((action) => {
      if (!action || action.type !== 'mcp_call') return true;
      const tool = String(action.tool || '').trim();
      if (tool === 'plugins.settings.update') {
        if (!pluginMatches.length) return false;
        const payload = action.input && typeof action.input === 'object'
          ? ((action.input as any).data ?? (action.input as any).config ?? null) : null;
        if (!payload || !PathObjectHelpers.objectContainsText(payload, replaceInstruction.to)) return false;
      }
      if (tool === 'themes.config.update') {
        if (!themeMatches.length) return false;
        const payload = action.input && typeof action.input === 'object'
          ? ((action.input as any).data ?? (action.input as any).config ?? null) : null;
        if (!payload || !PathObjectHelpers.objectContainsText(payload, replaceInstruction.to)) return false;
      }
      if (tool === 'content.update') {
        const payloadRaw = action.input && typeof action.input === 'object' && (action.input as any).data ? (action.input as any).data : null;
        const payload = payloadRaw ? PathObjectHelpers.normalizePathKeyedObject(payloadRaw) : null;
        if (!payload || !PathObjectHelpers.objectContainsText(payload, replaceInstruction.to)) return false;
        const collectionSlug = String((action.input as any)?.collectionSlug || '').trim();
        const recordId = (action.input as any)?.id;
        if (!collectionSlug || recordId === undefined || recordId === null) return false;
        if (ReplaceContentHelpers.isInternalTarget(collectionSlug, recordId)) return false;
        const payloadEntries = SearchTextHelpers.collectStringPayloadEntries(payload).filter((e) =>
          PathObjectHelpers.objectContainsText(e.value, replaceInstruction.to));
        if (!payloadEntries.length || !contentMatches.length) return false;
        const hasEvidence = payloadEntries.some((entry) =>
          contentMatches.some((match) =>
            String(match.collectionSlug || '').trim() === collectionSlug &&
            String(match.recordId) === String(recordId) &&
            PathObjectHelpers.pathsLikelySame(match.field, entry.path)));
        if (!hasEvidence) return false;
      }
      if (tool === 'plugins.files.replace_text') {
        const slug = String((action.input as any)?.slug || '').trim();
        const filePath = String((action.input as any)?.path || '').trim();
        if (!slug || !filePath) return false;
        if (!pluginFileMatches.some((m) => String(m.slug || '').trim() === slug && String(m.path || '').trim() === filePath)) return false;
      }
      if (tool === 'themes.files.replace_text') {
        const slug = String((action.input as any)?.slug || '').trim();
        const filePath = String((action.input as any)?.path || '').trim();
        if (!slug || !filePath) return false;
        if (!themeFileMatches.some((m) => String(m.slug || '').trim() === slug && String(m.path || '').trim() === filePath)) return false;
      }
      return true;
    });
  }

  static async stageFallbackReplaceActions(
    message: string,
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    mcpBridge: McpBridge,
    options: Pick<AdminAssistantRuntimeOptions, 'resolveContent' | 'findCollectionBySlug'>,
  ): Promise<AssistantAction[]> {
    const replaceInstruction = ReplaceContentHelpers.parseReplaceInstruction(message);
    if (!replaceInstruction) return [];
    const grouped = new Map<string, Array<{ collectionSlug: string; recordId: string | number; field: string; value: string }>>();
    for (const match of ReplaceContentHelpers.collectContentSearchMatches(toolResults)) {
      const key = `${match.collectionSlug}::${String(match.recordId)}`;
      const list = grouped.get(key) || [];
      list.push(match);
      grouped.set(key, list);
    }
    const staged: AssistantAction[] = [];
    if (typeof options.resolveContent === 'function') {
      for (const [groupKey, groupMatches] of grouped.entries()) {
        const [collectionSlug, recordIdRaw] = groupKey.split('::');
        if (ReplaceContentHelpers.isInternalTarget(collectionSlug, recordIdRaw)) continue;
        const collection = options.findCollectionBySlug(collectionSlug);
        if (!collection) continue;
        const recordId: string | number = /^\d+$/.test(String(recordIdRaw || '')) ? Number(recordIdRaw) : recordIdRaw;
        const existing = await options.resolveContent(collection, { id: recordId }, { dryRun: true }).catch(() => null);
        if (!existing || typeof existing !== 'object') continue;
        const updatedRecord = PathObjectHelpers.deepClone(existing);
        const changedRoots = new Set<string>();
        for (const match of groupMatches) {
          const segments = PathObjectHelpers.parsePathSegments(match.field);
          if (!segments.length) continue;
          const root = String(segments[0] ?? '').trim();
          if (!root) continue;
          const currentValue = PathObjectHelpers.getBySegments(updatedRecord, segments);
          if (typeof currentValue !== 'string') continue;
          const replacedValue = SearchTextHelpers.replaceTextInsensitive(currentValue, replaceInstruction.from, replaceInstruction.to);
          if (replacedValue === currentValue) continue;
          PathObjectHelpers.setBySegments(updatedRecord, segments, replacedValue);
          changedRoots.add(root);
        }
        for (const root of changedRoots) {
          if (JSON.stringify((existing as any)?.[root]) === JSON.stringify((updatedRecord as any)?.[root])) continue;
          staged.push({ type: 'mcp_call', tool: 'content.update', input: { collectionSlug: collection.slug, id: recordId, data: { [root]: (updatedRecord as any)[root] } } });
        }
      }
    }
    for (const [slug, paths] of ReplaceContentHelpers._buildPathsBySlug(ReplaceContentHelpers.collectConfigSearchMatches(toolResults, 'plugins.settings.search_text')).entries()) {
      const configResult = await mcpBridge.call({ tool: 'plugins.settings.get', input: { slug }, context: { dryRun: true } });
      if (!configResult?.ok) continue;
      const currentConfig = (configResult.output as any)?.config ?? {};
      const patch: Record<string, any> = {};
      let hasChange = false;
      for (const path of paths.values()) {
        const segments = PathObjectHelpers.normalizeConfigPathSegments(path);
        if (!segments.length) continue;
        const currentValue = PathObjectHelpers.getBySegments(currentConfig, segments);
        if (typeof currentValue !== 'string') continue;
        const replacedValue = SearchTextHelpers.replaceTextInsensitive(currentValue, replaceInstruction.from, replaceInstruction.to);
        if (replacedValue === currentValue) continue;
        PathObjectHelpers.setBySegments(patch, segments, replacedValue);
        hasChange = true;
      }
      if (hasChange && Object.keys(patch).length) staged.push({ type: 'mcp_call', tool: 'plugins.settings.update', input: { slug, merge: true, data: patch } });
    }
    for (const [slug, paths] of ReplaceContentHelpers._buildPathsBySlug(ReplaceContentHelpers.collectConfigSearchMatches(toolResults, 'themes.config.search_text')).entries()) {
      const configResult = await mcpBridge.call({ tool: 'themes.config.get', input: { slug }, context: { dryRun: true } });
      if (!configResult?.ok) continue;
      const currentConfig = (configResult.output as any)?.config ?? {};
      const patch: Record<string, any> = {};
      let hasChange = false;
      for (const path of paths.values()) {
        const segments = PathObjectHelpers.normalizeConfigPathSegments(path);
        if (!segments.length) continue;
        const currentValue = PathObjectHelpers.getBySegments(currentConfig, segments);
        if (typeof currentValue !== 'string') continue;
        const replacedValue = SearchTextHelpers.replaceTextInsensitive(currentValue, replaceInstruction.from, replaceInstruction.to);
        if (replacedValue === currentValue) continue;
        PathObjectHelpers.setBySegments(patch, segments, replacedValue);
        hasChange = true;
      }
      if (hasChange && Object.keys(patch).length) staged.push({ type: 'mcp_call', tool: 'themes.config.update', input: { slug, merge: true, data: patch } });
    }
    const shouldForceFile = IntentClassifier.isExplicitFileModificationIntent(message);
    const hasManagedChanges = staged.some((a) => a.type === 'mcp_call' && ['content.update', 'plugins.settings.update', 'themes.config.update'].includes(String(a.tool || '')));
    if (!shouldForceFile && hasManagedChanges) return staged;
    for (const target of ReplaceContentHelpers._collectUniqueTargets(ReplaceContentHelpers.collectScopedFileSearchMatches(toolResults, 'plugins.files.search_text'))) {
      staged.push({ type: 'mcp_call', tool: 'plugins.files.replace_text', input: { slug: target.slug, path: target.path, from: replaceInstruction.from, to: replaceInstruction.to } });
    }
    for (const target of ReplaceContentHelpers._collectUniqueTargets(ReplaceContentHelpers.collectScopedFileSearchMatches(toolResults, 'themes.files.search_text'))) {
      staged.push({ type: 'mcp_call', tool: 'themes.files.replace_text', input: { slug: target.slug, path: target.path, from: replaceInstruction.from, to: replaceInstruction.to } });
    }
    return staged;
  }

  private static _buildPathsBySlug(matches: Array<{ slug: string; path: string; value: string }>): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const match of matches) {
      const set = map.get(match.slug) || new Set<string>();
      set.add(match.path);
      map.set(match.slug, set);
    }
    return map;
  }

  private static _collectUniqueTargets(matches: Array<{ slug: string; path: string; value: string }>): Array<{ slug: string; path: string }> {
    const targets = new Map<string, { slug: string; path: string }>();
    for (const match of matches) {
      const key = `${match.slug}::${match.path}`;
      if (!targets.has(key)) targets.set(key, { slug: match.slug, path: match.path });
    }
    return Array.from(targets.values());
  }
}
