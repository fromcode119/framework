import type {
  AdminAssistantRuntimeOptions, AssistantAction, AssistantCollectionContext,
  AssistantPlanStatus, AssistantPlanStep, AssistantRunMode,
  AssistantSkillDefinition, AssistantSkillRiskPolicy, AssistantThemeContext, AssistantToolSummary,
  AssistantChatTrace, AssistantPluginContext,
} from '../types';
import { AssistantCopyUtils } from '../../assistant-copy';
import { AssistantConstants } from '../constants';
import { RuntimePlanHelpers } from './runtime-plan-helpers';

/** Miscellaneous runtime helpers extracted from AdminAssistantRuntime. */
export class RuntimeMiscHelpers {
  static toRunMode(input: string): AssistantRunMode {
    const v = String(input || '').trim().toLowerCase();
    if (v === 'plan') return 'plan';
    if (v === 'agent') return 'agent';
    return 'chat';
  }

  static defaultSkillCatalog(): AssistantSkillDefinition[] {
    return AssistantCopyUtils.DEFAULT_SKILLS.map((skill) => ({
      ...skill,
      allowedTools: Array.isArray(skill.allowedTools) ? [...skill.allowedTools] : undefined,
      entryExamples: Array.isArray(skill.entryExamples) ? [...skill.entryExamples] : undefined,
    })) as AssistantSkillDefinition[];
  }

  static normalizeSkills(skills: AssistantSkillDefinition[]): AssistantSkillDefinition[] {
    const seen = new Set<string>();
    const output: AssistantSkillDefinition[] = [];
    for (const item of Array.isArray(skills) ? skills : []) {
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id || '').trim().toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      output.push({
        id, label: String(item.label || id),
        description: item.description ? String(item.description) : undefined,
        defaultMode: RuntimeMiscHelpers.toRunMode(String(item.defaultMode || 'chat')),
        allowedTools: Array.isArray(item.allowedTools) ? item.allowedTools.map((t) => String(t || '').trim()).filter(Boolean) : undefined,
        systemPromptPatch: item.systemPromptPatch ? String(item.systemPromptPatch) : undefined,
        riskPolicy: (String(item.riskPolicy || 'approval_required').trim().toLowerCase() as AssistantSkillRiskPolicy) || 'approval_required',
        entryExamples: Array.isArray(item.entryExamples) ? item.entryExamples.map((e) => String(e || '').trim()).filter(Boolean) : undefined,
      });
    }
    if (!output.some((s) => s.id === 'general')) output.unshift(RuntimeMiscHelpers.defaultSkillCatalog()[0]);
    return output;
  }

  static formatToolLabel(tool: string): string {
    const key = String(tool || '').trim();
    if (!key) return 'Tool';
    if (AssistantConstants.TOOL_LABELS[key]) return AssistantConstants.TOOL_LABELS[key];
    return key.split('.').map((p) => p.replace(/_/g, ' ')).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  static isInterimPlanningMessage(message: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text) return true;
    return /gathering context|searching|running tool|checking current value|checking\b|preparing|planning\b|updating|working|in progress|fetching|analyzing|loading|please wait/.test(text);
  }

  static containsPlaceholderTarget(message: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text) return false;
    return /\bid_of_content_item\b|\bid_of_record\b|\bplaceholder\b|\bid\s*[:=]?\s*12345\b|\brecord id\s*[:=]?\s*12345\b/.test(text);
  }

  static inferSearchQueryFromPrompt(prompt: string): string {
    const source = String(prompt || '').trim();
    if (!source) return '';
    const replaceMatch = source.match(/replace\s+["']([^"']+)["']\s+(?:with|to)\s+["'][^"']+["']/i);
    if (replaceMatch?.[1]) return String(replaceMatch[1]).trim();
    const quoted = source.match(/["']([^"']+)["']/);
    if (quoted?.[1]) return String(quoted[1]).trim();
    const normalized = source.replace(/\b(update|change|rename|replace|from|to|with|please|can you|i need to)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return normalized.split(' ').slice(0, 4).join(' ').trim();
  }

  static splitPromptLines(value: string): string[] {
    const text = String(value || '').trim();
    if (!text) return [];
    return text.split(/\r?\n/).map((l) => String(l || '').trim()).filter(Boolean);
  }

  static buildDefaultBasicSystemPromptFromCopy(promptCopyOverride?: string[], customPromptOverride?: string): string {
    const copyLines = Array.isArray(promptCopyOverride) && promptCopyOverride.length > 0
      ? promptCopyOverride.map((l) => String(l || '').trim()).filter(Boolean) : [...AssistantCopyUtils.PROMPT_COPY.basic];
    const customLines = RuntimeMiscHelpers.splitPromptLines(String(customPromptOverride || ''));
    return [...customLines, ...copyLines,
      'Never claim you cannot access backend data, plugins, or system context.',
      'Chat mode is read-only. Never claim that records, settings, plugins, or themes were changed.',
      'Never expose raw internal tool IDs (for example: content.update, settings.set) in user-facing text.',
      'Do not return JSON, code fences, or tool call objects.', ...AssistantCopyUtils.VIBE_SECTION].join('\n');
  }

  static buildDefaultAdvancedSystemPromptFromCopy(promptCopyOverride?: string[], customPromptOverride?: string): string {
    const copyLines = Array.isArray(promptCopyOverride) && promptCopyOverride.length > 0
      ? promptCopyOverride.map((l) => String(l || '').trim()).filter(Boolean) : [...AssistantCopyUtils.PROMPT_COPY.advanced];
    const customLines = RuntimeMiscHelpers.splitPromptLines(String(customPromptOverride || ''));
    return [...customLines, ...copyLines,
      'You are running inside a real Fromcode backend context. Never claim you cannot access backend data.',
      'Return STRICT JSON only with this shape:',
      '{"message":"string","done":boolean,"toolCalls":[{"tool":"string","input":{...}}],"actions":[{"type":"create_content","collectionSlug":"string","data":{...}},{"type":"update_setting","key":"string","value":"string"},{"type":"mcp_call","tool":"string","input":{...}}]}',
      'actions are staged for explicit user approval before execution.',
      'Never stage read-only tools as actions; keep read tools in toolCalls only.',
      'Only use supported action types: create_content, update_setting, mcp_call.',
      'Never claim a mutation is already applied during planning; explicitly say it is staged/pending approval.',
      'update_setting is ONLY for real system meta setting keys. Never use it for content labels, collection text, plugin/theme config, or locale copy.',
      'For read-only discovery questions (where/find/list), do not stage write actions.',
      'Never claim a write was applied unless an action is staged and later executed.',
      'User-facing "message" must be plain language. Never expose raw tool IDs in message text.',
      'Do not invent endpoints.', ...AssistantCopyUtils.VIBE_SECTION].join('\n');
  }

  static buildRuntimeContextLines(
    collections: AssistantCollectionContext[], plugins: AssistantPluginContext[],
    themes: AssistantThemeContext[], tools: AssistantToolSummary[],
  ): string[] {
    return [
      `Available collections: ${JSON.stringify(collections.map((c) => ({ slug: c.slug, shortSlug: c.shortSlug, label: c.label, pluginSlug: c.pluginSlug })))}`,
      `Installed plugins: ${JSON.stringify(plugins.map((p) => ({ slug: p.slug, name: p.name, version: p.version, state: p.state, capabilities: Array.isArray(p.capabilities) ? p.capabilities : [] })))}`,
      `Installed themes: ${JSON.stringify(themes.map((t) => ({ slug: t.slug, name: t.name, version: t.version, state: t.state })))}`,
      `Available MCP tools: ${JSON.stringify(tools)}`,
    ];
  }

  static sanitizeUserFacingMessage(message: string, mode: 'basic' | 'advanced'): string {
    let text = String(message || '').trim();
    if (!text) return text;
    const replacements = new Map<string, string>([
      ['content.update', RuntimeMiscHelpers.formatToolLabel('content.update')],
      ['content.search_text', RuntimeMiscHelpers.formatToolLabel('content.search_text')],
      ['content.resolve', RuntimeMiscHelpers.formatToolLabel('content.resolve')],
      ['plugins.settings.update', RuntimeMiscHelpers.formatToolLabel('plugins.settings.update')],
      ['plugins.settings.search_text', RuntimeMiscHelpers.formatToolLabel('plugins.settings.search_text')],
      ['plugins.files.search_text', RuntimeMiscHelpers.formatToolLabel('plugins.files.search_text')],
      ['plugins.files.replace_text', RuntimeMiscHelpers.formatToolLabel('plugins.files.replace_text')],
      ['themes.config.update', RuntimeMiscHelpers.formatToolLabel('themes.config.update')],
      ['themes.config.search_text', RuntimeMiscHelpers.formatToolLabel('themes.config.search_text')],
      ['themes.files.search_text', RuntimeMiscHelpers.formatToolLabel('themes.files.search_text')],
      ['themes.files.replace_text', RuntimeMiscHelpers.formatToolLabel('themes.files.replace_text')],
      ['settings.set', RuntimeMiscHelpers.formatToolLabel('settings.set')],
      ['settings.get', RuntimeMiscHelpers.formatToolLabel('settings.get')],
    ]);
    for (const [raw, label] of replacements.entries()) {
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), label);
    }
    text = text.replace(/\buse the ([A-Za-z][A-Za-z ]+?) tool\b/gi, 'use $1');
    text = text.replace(/\busing the ([A-Za-z][A-Za-z ]+?) tool\b/gi, 'using $1');
    const lower = text.toLowerCase();
    if (/read-?only/.test(lower) && (/plan mode/.test(lower) || /can'?t make changes|cannot make changes|unable to make changes/.test(lower))) {
      text = mode === 'basic'
        ? 'To make changes, switch to **Plan** mode. I will stage the updates and you can approve them before anything is applied.'
        : 'I can stage this in **Plan** mode right now. Review the staged actions, run preview, then approve apply.';
    }
    text = text.replace(/^(?:great question[,!.\s-]*|i['']?d be happy to help[,!.\s-]*|absolutely[,!.\s-]*)+/i, '');
    text = text.replace(/i need one more pass to (?:finish|complete) this plan safely\.?\s*continue\??/gi, AssistantCopyUtils.RUNTIME_COPY.clarificationNeeded);
    return (text.replace(/^\s+/, '') || 'I am ready.');
  }

  static normalizePlanModeMessage(message: string, mode: 'basic' | 'advanced', hasActions: boolean, done: boolean): string {
    const text = String(message || '').trim();
    if (mode !== 'advanced') return text;
    if (hasActions && /\b(no further action required|no action required|nothing to do|already done|already updated)\b/i.test(text))
      return 'Plan is ready. Review staged actions below, then run Preview or Apply.';
    const looksWrong = /read-?only|can't make changes|cannot make changes|unable to make changes|switch to plan mode|click(?:ing)?\s+on\s+the\s+["']?plan/i.test(text);
    if (!looksWrong) return text;
    if (hasActions) return 'Plan is ready. Review staged actions below, then run Preview or Apply.';
    if (done) return 'You are already in Plan mode. No executable actions were staged, so nothing was changed.';
    return 'You are already in Plan mode. I have not staged executable actions yet.';
  }

  static pickRecordFields(source: any, keys: string[]): Record<string, any> {
    const safeSource = source && typeof source === 'object' ? source : {};
    const output: Record<string, any> = {};
    for (const key of keys) {
      if (!key) continue;
      const value = (safeSource as any)[key];
      output[key] = value === undefined ? null : value;
    }
    return output;
  }

  static diffChangedFields(before: any, payload: Record<string, any>): Array<{ field: string; before: any; after: any }> {
    const safeBefore = before && typeof before === 'object' ? before : {};
    return Object.keys(payload || {})
      .map((field) => ({ field, before: (safeBefore as any)[field], after: payload[field] }))
      .filter((e) => JSON.stringify(e.before) !== JSON.stringify(e.after));
  }

  static normalizePreviewPath(value: any): string | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    const lowered = raw.toLowerCase();
    if (/^[a-z]+:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return undefined;
    const looksAbsoluteUnix = (p: string) =>
      p.startsWith('/') && (/^\/(users|home|var|private|tmp|opt|etc)\//i.test(p) || /\.(tsx?|jsx?|json|md|css|scss|sass|less|map|lock|log|env)(?:\?.*)?$/i.test(p));
    if (looksAbsoluteUnix(raw) || /^(users|home|var|private|tmp|opt|etc)\//i.test(raw) || /^[a-z]:[\\/]/i.test(raw) || /^\\\\/.test(raw) ||
        (/\/(?:src|dist|build|node_modules|themes|plugins)\//i.test(lowered) && /\.[a-z0-9]+(?:\?.*)?$/i.test(raw)) ||
        (/^(?:src|dist|build|node_modules|themes|plugins)\//i.test(raw) && /\.[a-z0-9]+(?:\?.*)?$/i.test(raw))) return undefined;
    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        const pathName = String(parsed.pathname || '').trim();
        const lp = pathName.toLowerCase();
        if (looksAbsoluteUnix(pathName) || /^[a-z]:[\\/]/i.test(pathName) || /\/(?:users|home|var|private|tmp|opt|etc)\//i.test(lp) ||
            (/\/(?:src|dist|build|node_modules|themes|plugins)\//i.test(lp) && /\.[a-z0-9]+(?:\?.*)?$/i.test(pathName))) return undefined;
      } catch { /* keep raw */ }
      return raw;
    }
    if (raw.startsWith('/')) return raw;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  static resolveRecordPreviewPath(record: any, collectionSlug?: string): string | undefined {
    if (!record || typeof record !== 'object') return undefined;
    const directKeys = ['customPermalink', 'permalink', 'path', 'url', 'slug'];
    const candidateValues: any[] = directKeys.map((k) => (record as any)?.[k]);
    const data = (record as any)?.data && typeof (record as any).data === 'object' ? (record as any).data : null;
    if (data) { directKeys.forEach((k) => candidateValues.push((data as any)?.[k])); candidateValues.push((data as any)?.route); }
    for (const value of candidateValues) { const r = RuntimeMiscHelpers.normalizePreviewPath(value); if (r) return r; }
    const normalizedSlug = String(collectionSlug || '').toLowerCase();
    if (normalizedSlug.includes('cms_pages') || normalizedSlug.endsWith('.pages')) {
      const slug = String((record as any)?.slug || (data as any)?.slug || '').trim().toLowerCase();
      if (!slug || ['home', 'index', 'root'].includes(slug) || String((record as any)?.id ?? ((record as any)?.recordId || '')).trim() === '1') return '/';
    }
    for (const k of directKeys) { const r = RuntimeMiscHelpers.normalizePreviewPath((record as any)?.[k]); if (r) return r; }
    return undefined;
  }

  static resolveRecordPreviewTitle(record: any): string | undefined {
    if (!record || typeof record !== 'object') return undefined;
    for (const key of ['title', 'label', 'name']) {
      const value = String((record as any)?.[key] ?? '').trim();
      if (value) return value;
    }
    return undefined;
  }

  static extractJsonObject(text: string): any | null {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(cleaned); } catch { /* fall through */ }
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; } }
    return null;
  }

  static isInternalAssistantSessionTarget(collectionSlug: string, recordId: any): boolean {
    if (String(collectionSlug || '').trim().toLowerCase() !== 'settings') return false;
    return String(recordId ?? '').trim().toLowerCase().startsWith(AssistantConstants.INTERNAL_ASSISTANT_SESSION_KEY_PREFIX);
  }

  static isInternalAssistantSessionRecord(collectionSlug: string, record: any): boolean {
    if (String(collectionSlug || '').trim().toLowerCase() !== 'settings') return false;
    const key = String((record as any)?.key || '').trim().toLowerCase();
    const group = String((record as any)?.group || '').trim().toLowerCase();
    return key.startsWith(AssistantConstants.INTERNAL_ASSISTANT_SESSION_KEY_PREFIX) || group === 'assistant-session';
  }

  static toolMatchStatsByTool(toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>): Map<string, number> {
    const stats = new Map<string, number>();
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      const tool = String(item?.tool || '').trim();
      if (!tool) continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      const matches = Array.isArray((output as any).matches) ? (output as any).matches : [];
      const totalMatches = Number((output as any).totalMatches ?? matches.length ?? 0);
      const safeTotal = Number.isFinite(totalMatches) && totalMatches > 0 ? totalMatches : 0;
      const current = Number(stats.get(tool) || 0);
      stats.set(tool, safeTotal > current ? safeTotal : current);
    }
    return stats;
  }

  static shouldUseToolSummaryOverride(
    currentMessage: string, toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
  ): boolean {
    const message = String(currentMessage || '').trim().toLowerCase();
    if (!message || RuntimeMiscHelpers.isInterimPlanningMessage(message) || /no response generated/.test(message)) return true;
    const stats = RuntimeMiscHelpers.toolMatchStatsByTool(toolResults);
    if (!Array.from(stats.values()).some((v) => Number(v) > 0)) return false;
    if (/\bno matches\b/.test(message)) return true;
    if (message.includes('plugin settings') && !message.includes('content') && !message.includes('theme')) {
      if (Number(stats.get('content.search_text') || 0) > 0 || Number(stats.get('themes.config.search_text') || 0) > 0) return true;
    }
    return false;
  }
}