import { AssistantClient, AssistantMessage } from './types';
import { createMcpBridge, McpBridge, McpToolDefinition } from '@fromcode119/mcp';

export type AssistantCollectionContext = {
  slug: string;
  shortSlug: string;
  label: string;
  pluginSlug: string;
  raw?: any;
};

export type AssistantPluginContext = {
  slug: string;
  name: string;
  version: string;
  state: string;
  capabilities?: string[];
};

export type AssistantThemeContext = {
  slug: string;
  name: string;
  version: string;
  state: string;
};

export type AssistantAction = {
  type: 'create_content' | 'update_setting' | 'mcp_call';
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
};

export type AssistantToolSummary = Pick<McpToolDefinition, 'tool' | 'description' | 'readOnly'>;

export type AssistantChatTrace = {
  iteration: number;
  message: string;
  phase?: 'planner' | 'executor' | 'verifier';
  toolCalls: Array<{ tool: string; input: Record<string, any> }>;
};

export type AssistantRunMode = 'chat' | 'plan' | 'agent';

export type AssistantSkillRiskPolicy = 'read_only' | 'approval_required' | 'allowlisted_auto_apply';

export type ForgeSkillDefinition = {
  id: string;
  label: string;
  description?: string;
  defaultMode?: AssistantRunMode;
  allowedTools?: string[];
  systemPromptPatch?: string;
  riskPolicy?: AssistantSkillRiskPolicy;
  entryExamples?: string[];
};

export type AssistantPlanStatus =
  | 'draft'
  | 'searching'
  | 'staged'
  | 'paused'
  | 'ready_for_preview'
  | 'ready_for_apply'
  | 'completed'
  | 'failed';

export type AssistantPlanStep = {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description?: string;
  toolCalls?: Array<{ tool: string; input: Record<string, any> }>;
};

export type AssistantPlanArtifact = {
  id: string;
  status: AssistantPlanStatus;
  goal: string;
  summary: string;
  steps: AssistantPlanStep[];
  actions: AssistantAction[];
  risk: 'low' | 'medium' | 'high';
  previewReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssistantUiHints = {
  canContinue: boolean;
  requiresApproval: boolean;
  suggestedMode: AssistantRunMode;
  showTechnicalDetailsDefault: boolean;
};

export type AssistantSessionCheckpoint = {
  resumePrompt: string;
  reason: 'loop_cap' | 'time_cap' | 'user_continue';
};

export type AssistantChatResult = {
  message: string;
  actions: AssistantAction[];
  model: string;
  agentMode: 'basic' | 'advanced';
  done: boolean;
  traces: AssistantChatTrace[];
  plan?: AssistantPlanArtifact;
  ui?: AssistantUiHints;
  skill?: ForgeSkillDefinition;
  sessionId?: string;
  checkpoint?: AssistantSessionCheckpoint;
  iterations?: number;
  loopCapReached?: boolean;
};

export type AssistantExecuteResult = {
  success: boolean;
  dryRun: boolean;
  results: any[];
};

export type AssistantChatInput = {
  message: string;
  history?: Array<{ role?: string; content?: string }>;
  agentMode?: string;
  maxIterations?: number;
  maxDurationMs?: number;
  allowedTools?: string[];
  skillId?: string;
  sessionId?: string;
  continueFrom?: boolean;
};

export type AssistantExecuteInput = {
  actions: any[];
  dryRun?: boolean;
  context?: Record<string, any>;
};

export type AssistantSettingValue = {
  found: boolean;
  value: any;
  group?: string | null;
};

export type AssistantPromptProfile = {
  basicSystem?: string;
  advancedSystem?: string;
};

export type AdminAssistantRuntimeOptions = {
  aiClient?: AssistantClient | null;
  getCollections: () => AssistantCollectionContext[];
  getPlugins?: () => AssistantPluginContext[];
  getThemes?: () => AssistantThemeContext[];
  findCollectionBySlug: (source: string) => AssistantCollectionContext | null | undefined;
  listContent?: (
    collection: AssistantCollectionContext,
    options: { limit?: number; offset?: number; context?: Record<string, any> }
  ) => Promise<{ docs: any[]; totalDocs?: number; limit?: number; offset?: number }>;
  resolveContent?: (
    collection: AssistantCollectionContext,
    selector: {
      id?: string | number;
      slug?: string;
      permalink?: string;
      where?: Record<string, any>;
    },
    context: Record<string, any>
  ) => Promise<any | null>;
  createContent: (
    collection: AssistantCollectionContext,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  updateContent?: (
    collection: AssistantCollectionContext,
    targetId: string | number,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  getSetting: (key: string) => Promise<AssistantSettingValue>;
  upsertSetting: (key: string, value: string, group: string) => Promise<void>;
  resolveAdditionalTools?: (context: { dryRun: boolean }) => Promise<McpToolDefinition[]> | McpToolDefinition[];
  resolveAdditionalPromptLines?: (context: {
    collections: AssistantCollectionContext[];
    tools: AssistantToolSummary[];
  }) => Promise<string[]> | string[];
  resolvePromptProfile?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantPromptProfile> | AssistantPromptProfile;
  resolveSkills?: () => Promise<ForgeSkillDefinition[]> | ForgeSkillDefinition[];
  now?: () => string;
};

const VALID_HISTORY_ROLES = new Set<AssistantMessage['role']>(['system', 'user', 'assistant']);
const TOOL_LABELS: Record<string, string> = {
  'content.search_text': 'Content Search',
  'content.resolve': 'Content Lookup',
  'content.update': 'Content Update',
  'content.create': 'Content Create',
  'content.list': 'Content List',
  'plugins.settings.search_text': 'Plugin Settings Search',
  'plugins.settings.update': 'Plugin Settings Update',
  'plugins.settings.get': 'Plugin Settings Read',
  'themes.config.search_text': 'Theme Config Search',
  'themes.config.update': 'Theme Config Update',
  'themes.config.get': 'Theme Config Read',
  'settings.get': 'Settings Read',
  'settings.set': 'Settings Update',
  'web.search': 'Web Search',
  'web.fetch': 'Page Fetch',
};

export class AdminAssistantRuntime {
  constructor(private readonly options: AdminAssistantRuntimeOptions) {}

  private toRunMode(input: string): AssistantRunMode {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'plan') return 'plan';
    if (value === 'agent') return 'agent';
    return 'chat';
  }

  private defaultSkillCatalog(): ForgeSkillDefinition[] {
    return [
      {
        id: 'general',
        label: 'General',
        description: 'Balanced assistant for chat, planning, and approvals.',
        defaultMode: 'chat',
        riskPolicy: 'approval_required',
      },
      {
        id: 'editor',
        label: 'Content Editor',
        description: 'Focus on safe content and copy updates across collections.',
        defaultMode: 'plan',
        allowedTools: [
          'collections.list',
          'collections.resolve',
          'content.list',
          'content.resolve',
          'content.search_text',
          'content.update',
          'content.create',
          'plugins.settings.search_text',
          'themes.config.search_text',
          'system.now',
        ],
        systemPromptPatch:
          'Prioritize deterministic content edits with explicit selectors and field paths. Stage only concrete updates.',
        riskPolicy: 'approval_required',
        entryExamples: [
          'Replace "Slow Websites" with "Better Sites" in homepage copy.',
          'Update hero title in fcp_cms_pages id=1.',
        ],
      },
      {
        id: 'ops',
        label: 'Ops Assistant',
        description: 'Inspect plugins, themes, and settings with a planning-first workflow.',
        defaultMode: 'plan',
        allowedTools: [
          'plugins.list',
          'plugins.settings.get',
          'plugins.settings.search_text',
          'plugins.settings.update',
          'themes.list',
          'themes.active',
          'themes.config.get',
          'themes.config.search_text',
          'themes.config.update',
          'settings.get',
          'settings.set',
          'system.now',
          'web.search',
          'web.fetch',
        ],
        riskPolicy: 'approval_required',
      },
      {
        id: 'research',
        label: 'Web Research',
        description: 'Browse the web and summarize current external references.',
        defaultMode: 'chat',
        allowedTools: ['web.search', 'web.fetch', 'system.now'],
        systemPromptPatch:
          'Use web.search to discover sources, then web.fetch to cite concrete findings. Keep summaries short and source-linked.',
        riskPolicy: 'read_only',
        entryExamples: [
          'Research top contractor website messaging trends this month.',
          'Find 3 competitor hero claims and summarize differences.',
        ],
      },
      {
        id: 'page-audit',
        label: 'Page Auditor',
        description: 'Inspect live pages, compare with CMS/theme settings, and stage targeted fixes.',
        defaultMode: 'plan',
        allowedTools: [
          'web.fetch',
          'web.search',
          'collections.list',
          'content.list',
          'content.resolve',
          'content.search_text',
          'plugins.settings.get',
          'plugins.settings.search_text',
          'themes.config.get',
          'themes.config.search_text',
          'system.now',
        ],
        systemPromptPatch:
          'For website audits, fetch page URLs first, quote exact snippets, then map each issue to concrete content/theme/plugin paths.',
        riskPolicy: 'approval_required',
      },
    ];
  }

  private normalizeSkills(skills: ForgeSkillDefinition[]): ForgeSkillDefinition[] {
    const seen = new Set<string>();
    const output: ForgeSkillDefinition[] = [];
    for (const item of Array.isArray(skills) ? skills : []) {
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id || '').trim().toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      output.push({
        id,
        label: String(item.label || id),
        description: item.description ? String(item.description) : undefined,
        defaultMode: this.toRunMode(String(item.defaultMode || 'chat')),
        allowedTools: Array.isArray(item.allowedTools)
          ? item.allowedTools.map((tool) => String(tool || '').trim()).filter(Boolean)
          : undefined,
        systemPromptPatch: item.systemPromptPatch ? String(item.systemPromptPatch) : undefined,
        riskPolicy: (String(item.riskPolicy || 'approval_required').trim().toLowerCase() as AssistantSkillRiskPolicy) || 'approval_required',
        entryExamples: Array.isArray(item.entryExamples)
          ? item.entryExamples.map((entry) => String(entry || '').trim()).filter(Boolean)
          : undefined,
      });
    }
    if (!output.some((skill) => skill.id === 'general')) {
      output.unshift(this.defaultSkillCatalog()[0]);
    }
    return output;
  }

  async listSkills(): Promise<ForgeSkillDefinition[]> {
    const defaults = this.defaultSkillCatalog();
    const extra = await Promise.resolve(this.options.resolveSkills?.() || []);
    return this.normalizeSkills([...(Array.isArray(extra) ? extra : []), ...defaults]);
  }

  private buildPlanArtifact(input: {
    planId: string;
    goal: string;
    message: string;
    traces: AssistantChatTrace[];
    actions: AssistantAction[];
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: ForgeSkillDefinition;
  }): AssistantPlanArtifact {
    const {
      planId,
      goal,
      message,
      traces,
      actions,
      loopCapReached,
      loopTimeLimitReached,
      done,
      selectedSkill,
    } = input;
    const now = (this.options.now || (() => new Date().toISOString()))();
    const summary = String(message || '').trim();
    const hasActions = Array.isArray(actions) && actions.length > 0;
    let status: AssistantPlanStatus = 'draft';
    if (hasActions) {
      status = done ? 'ready_for_apply' : 'ready_for_preview';
    } else if (loopCapReached || loopTimeLimitReached) {
      status = 'paused';
    } else if (done) {
      status = 'completed';
    } else if (Array.isArray(traces) && traces.length > 0) {
      status = 'searching';
    }

    const hasWriteActions = actions.some((action) => {
      if (action.type === 'create_content' || action.type === 'update_setting') return true;
      return action.type === 'mcp_call' && !String(action.tool || '').includes('.search_') && !String(action.tool || '').endsWith('.get');
    });
    const riskFromWrites: 'low' | 'medium' | 'high' = hasWriteActions ? 'medium' : 'low';
    const risk =
      selectedSkill?.riskPolicy === 'allowlisted_auto_apply' && hasWriteActions
        ? 'high'
        : selectedSkill?.riskPolicy === 'read_only'
          ? 'low'
          : riskFromWrites;

    const steps: AssistantPlanStep[] = (Array.isArray(traces) ? traces : []).map((trace, index, all) => ({
      id: `${planId}-step-${index + 1}`,
      title: trace?.message
        ? `${trace?.phase ? `${String(trace.phase).charAt(0).toUpperCase()}${String(trace.phase).slice(1)}: ` : ''}${
            String(trace.message).trim() || `Step ${index + 1}`
          }`
        : `Step ${index + 1}`,
      status:
        index === all.length - 1 && status === 'searching'
          ? 'running'
          : 'completed',
      description: trace?.message ? String(trace.message).trim() : undefined,
      toolCalls: Array.isArray(trace?.toolCalls) ? trace.toolCalls : [],
    }));

    return {
      id: planId,
      status,
      goal: String(goal || '').trim() || 'User request',
      summary: summary || (hasActions ? 'Staged actions are ready for preview.' : 'No staged actions yet.'),
      steps,
      actions: Array.isArray(actions) ? actions : [],
      risk,
      previewReady: hasActions,
      createdAt: now,
      updatedAt: now,
    };
  }

  private buildUiHints(input: {
    hasActions: boolean;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: ForgeSkillDefinition;
  }): AssistantUiHints {
    const { hasActions, loopCapReached, loopTimeLimitReached, done, selectedSkill } = input;
    const suggestedMode: AssistantRunMode = hasActions
      ? 'plan'
      : (loopCapReached || loopTimeLimitReached) && !done
        ? 'agent'
        : selectedSkill?.defaultMode || 'chat';
    const requiresApproval = hasActions && selectedSkill?.riskPolicy !== 'allowlisted_auto_apply';
    return {
      canContinue: (loopCapReached || loopTimeLimitReached) && !hasActions,
      requiresApproval,
      suggestedMode,
      showTechnicalDetailsDefault: false,
    };
  }

  private normalizePlanModeMessage(
    message: string,
    mode: 'basic' | 'advanced',
    hasActions: boolean,
    done: boolean,
  ): string {
    const text = String(message || '').trim();
    if (mode !== 'advanced') return text;

    if (hasActions && /\b(no further action required|no action required|nothing to do|already done|already updated)\b/i.test(text)) {
      return 'Plan is ready. Review staged actions below, then run Preview or Apply.';
    }

    const looksReadOnlyOrWrongMode =
      /read-?only|can't make changes|cannot make changes|unable to make changes|switch to plan mode|click(?:ing)?\s+on\s+the\s+["']?plan/i.test(
        text,
      );

    if (!looksReadOnlyOrWrongMode) return text;

    if (hasActions) {
      return 'Plan is ready. Review staged actions below, then run Preview or Apply.';
    }
    if (done) {
      return 'You are already in Plan mode. No executable actions were staged, so nothing was changed.';
    }
    return 'You are already in Plan mode. I have not staged executable actions yet.';
  }

  private formatToolLabel(tool: string): string {
    const key = String(tool || '').trim();
    if (!key) return 'Tool';
    if (TOOL_LABELS[key]) return TOOL_LABELS[key];
    return key
      .split('.')
      .map((part) => part.replace(/_/g, ' '))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private sanitizeUserFacingMessage(message: string, mode: 'basic' | 'advanced'): string {
    let text = String(message || '').trim();
    if (!text) return text;

    const replacements = new Map<string, string>([
      ['content.update', this.formatToolLabel('content.update')],
      ['content.search_text', this.formatToolLabel('content.search_text')],
      ['content.resolve', this.formatToolLabel('content.resolve')],
      ['plugins.settings.update', this.formatToolLabel('plugins.settings.update')],
      ['plugins.settings.search_text', this.formatToolLabel('plugins.settings.search_text')],
      ['themes.config.update', this.formatToolLabel('themes.config.update')],
      ['themes.config.search_text', this.formatToolLabel('themes.config.search_text')],
      ['settings.set', this.formatToolLabel('settings.set')],
      ['settings.get', this.formatToolLabel('settings.get')],
    ]);

    for (const [raw, label] of replacements.entries()) {
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), label);
    }

    text = text.replace(/\buse the ([A-Za-z][A-Za-z ]+?) tool\b/gi, 'use $1');
    text = text.replace(/\busing the ([A-Za-z][A-Za-z ]+?) tool\b/gi, 'using $1');

    const lower = text.toLowerCase();
    const looksReadOnly =
      /read-?only/.test(lower) &&
      (/plan mode/.test(lower) || /can'?t make changes|cannot make changes|unable to make changes/.test(lower));

    if (looksReadOnly) {
      return mode === 'basic'
        ? 'To make changes, switch to **Plan** mode. I will stage the updates and you can approve them before anything is applied.'
        : 'I can stage this in **Plan** mode right now. Review the staged actions, run preview, then approve apply.';
    }

    return text;
  }

  private isInterimPlanningMessage(message: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text) return true;
    return /gathering context|searching|running tool|checking current value|checking\b|preparing|planning\b|updating|working|in progress|fetching|analyzing|loading|please wait/.test(
      text
    );
  }

  private containsPlaceholderTarget(message: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text) return false;
    return /\bid_of_content_item\b|\bid_of_record\b|\bplaceholder\b|\bid\s*[:=]?\s*12345\b|\brecord id\s*[:=]?\s*12345\b/.test(
      text,
    );
  }

  private buildRuntimeContextLines(
    collections: AssistantCollectionContext[],
    plugins: AssistantPluginContext[],
    themes: AssistantThemeContext[],
    tools: AssistantToolSummary[],
  ): string[] {
    return [
      `Available collections: ${JSON.stringify(collections.map((collection) => ({
        slug: collection.slug,
        shortSlug: collection.shortSlug,
        label: collection.label,
        pluginSlug: collection.pluginSlug,
      })))}`,
      `Installed plugins: ${JSON.stringify(plugins.map((plugin) => ({
        slug: plugin.slug,
        name: plugin.name,
        version: plugin.version,
        state: plugin.state,
        capabilities: Array.isArray(plugin.capabilities) ? plugin.capabilities : [],
      })))}`,
      `Installed themes: ${JSON.stringify(themes.map((theme) => ({
        slug: theme.slug,
        name: theme.name,
        version: theme.version,
        state: theme.state,
      })))}`,
      `Available MCP tools: ${JSON.stringify(tools)}`,
    ];
  }

  private buildDefaultBasicSystemPrompt(): string {
    return [
      'You are Fromcode Forge assistant running inside a live Fromcode admin instance.',
      'You have direct access to runtime context passed in this prompt.',
      'Never claim you cannot access backend data, plugins, or system context.',
      'If asked about installed/active plugins, answer directly from Installed plugins context.',
      'Chat mode is read-only. Never claim that records, settings, plugins, or themes were changed.',
      'When user asks to change data, explain that Plan mode is required for staged approval.',
      'Never expose raw internal tool IDs (for example: content.update, settings.set) in user-facing text.',
      'Use plain language like "I can stage this change in Plan mode".',
      'Reply conversationally with concise actionable help.',
      'Do not return JSON, code fences, or tool call objects.',
    ].join('\n');
  }

  private buildDefaultAdvancedSystemPrompt(): string {
    return [
      'You are the Fromcode Admin Assistant.',
      'You can reason in an autonomous loop and ask for tool calls.',
      'You are running inside a real Fromcode backend context. Never claim you cannot access backend data.',
      'If asked about installed or active plugins, use Installed plugins context and/or plugins.list.',
      'Return STRICT JSON only with this shape:',
      '{"message":"string","done":boolean,"toolCalls":[{"tool":"string","input":{...}}],"actions":[{"type":"create_content","collectionSlug":"string","data":{...}},{"type":"update_setting","key":"string","value":"string"},{"type":"mcp_call","tool":"string","input":{...}}]}',
      'toolCalls are executed in dry-run mode inside chat loop for observation.',
      'actions are staged for explicit user approval before execution.',
      'Never stage read-only tools as actions; keep read tools in toolCalls only.',
      'When you have enough info, set done=true.',
      'Only use supported action types: create_content, update_setting, mcp_call.',
      'Never claim a mutation is already applied during planning; explicitly say it is staged/pending approval.',
      'update_setting is ONLY for real system meta setting keys. Never use it for content labels, collection text, plugin/theme config, or locale copy.',
      'For plugin config changes, use plugins.settings.update. For theme config changes, use themes.config.update.',
      'For copy/label renames, first use content.search_text (and other read tools) to find exact matches, then stage content.update per concrete record/field.',
      'For cross-system replace requests (content + plugin settings + theme config), run content.search_text, plugins.settings.search_text, and themes.config.search_text before staging writes.',
      'For content edits, prefer mcp_call with tool "content.update" (target by id/slug/permalink).',
      'For read-only discovery questions (where/find/list), do not stage write actions.',
      'If the user asks about capabilities, modes, or what you can do/plan, answer directly without tool calls and set done=true.',
      'Never claim a write was applied unless an action is staged and later executed.',
      'User-facing "message" must be plain language. Never expose raw tool IDs in message text.',
      'Do not invent endpoints.',
    ].join('\n');
  }

  private pickRecordFields(source: any, keys: string[]): Record<string, any> {
    const output: Record<string, any> = {};
    const safeSource = source && typeof source === 'object' ? source : {};
    for (const key of keys) {
      if (!key) continue;
      const value = (safeSource as any)[key];
      output[key] = value === undefined ? null : value;
    }
    return output;
  }

  private diffChangedFields(before: any, payload: Record<string, any>): Array<{ field: string; before: any; after: any }> {
    const safeBefore = before && typeof before === 'object' ? before : {};
    return Object.keys(payload || {})
      .map((field) => ({
        field,
        before: (safeBefore as any)[field],
        after: payload[field],
      }))
      .filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after));
  }

  private normalizePreviewPath(value: any): string | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return raw;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  private resolveRecordPreviewPath(record: any, collectionSlug?: string): string | undefined {
    if (!record || typeof record !== 'object') return undefined;

    const candidateValues: any[] = [];
    const directKeys = ['customPermalink', 'permalink', 'path', 'url', 'slug'];
    for (const key of directKeys) {
      candidateValues.push((record as any)?.[key]);
    }
    const data = (record as any)?.data && typeof (record as any).data === 'object' ? (record as any).data : null;
    if (data) {
      for (const key of directKeys) {
        candidateValues.push((data as any)?.[key]);
      }
      candidateValues.push((data as any)?.route);
    }

    for (const value of candidateValues) {
      const resolved = this.normalizePreviewPath(value);
      if (resolved) return resolved;
    }

    const normalizedCollectionSlug = String(collectionSlug || '').toLowerCase();
    const looksLikeCmsPages = normalizedCollectionSlug.includes('cms_pages') || normalizedCollectionSlug.endsWith('.pages');
    if (looksLikeCmsPages) {
      const slug = String((record as any)?.slug || (data as any)?.slug || '').trim().toLowerCase();
      if (!slug || slug === 'home' || slug === 'index' || slug === 'root') return '/';
      const id = (record as any)?.id ?? (record as any)?.recordId;
      if (String(id || '').trim() === '1') return '/';
    }

    const candidateKeys = ['customPermalink', 'permalink', 'path', 'url', 'slug'];
    for (const key of candidateKeys) {
      const resolved = this.normalizePreviewPath((record as any)?.[key]);
      if (resolved) return resolved;
    }
    return undefined;
  }

  private resolveRecordPreviewTitle(record: any): string | undefined {
    if (!record || typeof record !== 'object') return undefined;
    const candidateKeys = ['title', 'label', 'name'];
    for (const key of candidateKeys) {
      const value = String((record as any)?.[key] ?? '').trim();
      if (value) return value;
    }
    return undefined;
  }

  private extractJsonObject(text: string): any | null {
    const raw = String(text || '').trim();
    if (!raw) return null;

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private isPotentialLocaleKey(key: string): boolean {
    return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(key || '').trim());
  }

  private normalizeSearchText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeSearchQuery(query: string): string[] {
    return this.normalizeSearchText(query)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }

  private normalizeWebUrl(input: string): URL {
    const raw = String(input || '').trim();
    if (!raw) throw new Error('Missing URL');
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error('Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs are supported');
    }
    return parsed;
  }

  private decodeHtmlEntities(value: string): string {
    const source = String(value || '');
    if (!source) return '';
    return source
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  private htmlToPlainText(html: string): string {
    const source = String(html || '');
    if (!source) return '';
    const withoutScripts = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
    const withoutStyles = withoutScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
    const withoutTags = withoutStyles.replace(/<\/?[^>]+>/g, ' ');
    return this.decodeHtmlEntities(withoutTags)
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractHtmlTitle(html: string): string | undefined {
    const source = String(html || '');
    if (!source) return undefined;
    const match = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = this.decodeHtmlEntities(String(match?.[1] || '').trim());
    return title || undefined;
  }

  private extractHtmlLinks(html: string, baseUrl: string, limit: number): string[] {
    const source = String(html || '');
    if (!source) return [];
    const output: string[] = [];
    const seen = new Set<string>();
    const max = Math.max(1, Math.min(30, Number(limit || 10)));
    const regex = /<a\b[^>]*href=(["'])(.*?)\1/gi;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(source))) {
      if (output.length >= max) break;
      const href = String(match?.[2] || '').trim();
      if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue;
      let resolved = href;
      try {
        resolved = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      output.push(resolved);
    }
    return output;
  }

  private tokenVariants(token: string): string[] {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return [];
    const variants = new Set<string>([normalized]);
    if (normalized.endsWith('s') && normalized.length > 3) {
      variants.add(normalized.slice(0, -1));
    } else if (!normalized.endsWith('s') && normalized.length > 3) {
      variants.add(`${normalized}s`);
    }
    return Array.from(variants);
  }

  private isReadOnlyDiscoveryIntent(prompt: string): boolean {
    const text = String(prompt || '').trim().toLowerCase();
    if (!text) return false;
    const hasDiscoveryIntent =
      /\b(where|find|locate|search|which|show|list|tell me where)\b/.test(text) ||
      /\b(where is|where are|what contains|what has)\b/.test(text);
    if (!hasDiscoveryIntent) return false;
    const hasWriteIntent = /\b(update|replace|change|rename|set|delete|create|apply|fix|edit|modify)\b/.test(text);
    return !hasWriteIntent;
  }

  private isCapabilityOverviewIntent(prompt: string): boolean {
    const text = String(prompt || '').trim().toLowerCase();
    if (!text) return false;

    const asksCapabilities =
      /\bwhat can you (?:do|plan|change|help|handle)\b/.test(text) ||
      /\bwhat do you do\b/.test(text) ||
      /\bhow can you help\b/.test(text) ||
      /\bwhat are your capabilities\b/.test(text) ||
      /\bshow (?:me )?(?:your )?(?:capabilities|modes)\b/.test(text) ||
      /\bexplain (?:plan|agent|chat) mode\b/.test(text) ||
      /\bhow (?:does|do) (?:plan|agent|chat) mode\b/.test(text);

    if (!asksCapabilities) return false;

    const hasSpecificTarget =
      /["']([^"']+)["']/.test(text) ||
      /\b(in|on|for)\s+[a-z0-9_\-/]{3,}/.test(text) ||
      /\b(update|replace|change|rename|set|delete|create|apply|fix|edit|modify)\b/.test(text);

    return !hasSpecificTarget;
  }

  private isStrategicAdviceIntent(prompt: string): boolean {
    const text = String(prompt || '').trim().toLowerCase();
    if (!text) return false;

    const asksStrategy =
      /\b(efficien(?:cy|t)|effienci(?:y|es)?|optimi[sz]e|improvement|improve|recommend(?:ation|ations)?|suggest(?:ion|ions)?|roadmap|priorit(?:y|ies)|quick wins?)\b/.test(text) ||
      /\bwhat (?:should|can) we improve\b/.test(text) ||
      /\bhow can we improve\b/.test(text) ||
      /\bwhat can we do better\b/.test(text) ||
      /\bwhat (?:efficiency|effienciy) improvements\b/.test(text);

    if (!asksStrategy) return false;

    const explicitWriteTarget =
      /\b(collection|record|id|slug|field|path|setting|key)\s*[:=]/.test(text) ||
      /\b(update|replace|change|rename|set|delete|create|apply|modify)\b/.test(text) ||
      /["']([^"']+)["']/.test(text);

    return !explicitWriteTarget;
  }

  private buildCapabilityOverviewMessage(
    collections: AssistantCollectionContext[],
    plugins: AssistantPluginContext[],
    themes: AssistantThemeContext[],
    tools: AssistantToolSummary[],
  ): string {
    const writableTools = (tools || [])
      .filter((tool) => !tool?.readOnly)
      .map((tool) => String(tool?.tool || '').trim())
      .filter(Boolean);
    const readTools = (tools || [])
      .filter((tool) => !!tool?.readOnly)
      .map((tool) => String(tool?.tool || '').trim())
      .filter(Boolean);
    const collectionCount = Array.isArray(collections) ? collections.length : 0;
    const pluginCount = Array.isArray(plugins) ? plugins.length : 0;
    const themeCount = Array.isArray(themes) ? themes.length : 0;

    return [
      `I can edit content and settings with approval-first safety.`,
      `Current scope: ${collectionCount} collections, ${pluginCount} plugins, ${themeCount} themes.`,
      `Tools: ${writableTools.length} write-capable, ${readTools.length} read/search.`,
      '',
      'If you want a change, just say it naturally (example: `Change homepage hero headline to "Better Websites"`).',
      'I will stage a plan, show preview, then apply only after your approval.',
    ].join('\n');
  }

  private buildStrategicAdviceFallbackMessage(
    collections: AssistantCollectionContext[],
    plugins: AssistantPluginContext[],
    themes: AssistantThemeContext[],
    tools: AssistantToolSummary[],
  ): string {
    const writeCount = (tools || []).filter((tool) => !tool?.readOnly).length;
    const readCount = (tools || []).filter((tool) => !!tool?.readOnly).length;
    return [
      'Here is a focused efficiency plan:',
      '1. Reduce planning dead-ends: ask me to “inspect first, then stage” so we always return findings before actions.',
      '2. Enforce two-pass flow: discovery pass (read-only) -> action pass (staged changes only).',
      '3. Improve apply reliability: require exact selectors (collection + id/slug + field path) before writes.',
      '4. Speed approvals: keep batch preview default, but apply per-action when failures are mixed.',
      '5. Tighten model routing: use read-only skill for analysis questions, writable skills only for concrete edits.',
      '',
      `Current workspace scope: ${collections.length} collections, ${plugins.length} plugins, ${themes.length} themes (${writeCount} write tools / ${readCount} read tools).`,
      'If you want, I can now convert this into a concrete implementation plan with milestones and expected impact.',
    ].join('\n');
  }

  private parseReplaceInstruction(prompt: string): { from: string; to: string } | null {
    const source = String(prompt || '').trim();
    if (!source) return null;

    const patterns: RegExp[] = [
      /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
      /update\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s*->\s*["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      const from = String(match?.[1] || '').trim();
      const to = String(match?.[2] || '').trim();
      if (from && to && from.toLowerCase() !== to.toLowerCase()) {
        return { from, to };
      }
    }

    return null;
  }

  private buildSharedReplaceSearchQuery(fromText: string, toText: string): string {
    const stop = new Set(['the', 'a', 'an', 'for', 'with', 'to', 'from', 'of', 'in', 'on', 'and', 'or', 'by']);
    const fromTokens = this.tokenizeSearchQuery(String(fromText || '')).filter((token) => !stop.has(token));
    const toTokenSet = new Set(this.tokenizeSearchQuery(String(toText || '')).filter((token) => !stop.has(token)));
    const shared: string[] = [];
    for (const token of fromTokens) {
      if (!toTokenSet.has(token)) continue;
      if (!shared.includes(token)) shared.push(token);
    }
    if (!shared.length) return '';
    return shared.slice(0, 6).join(' ').trim();
  }

  private escapeRegExp(text: string): string {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private replaceTextInsensitive(value: string, from: string, to: string): string {
    const source = String(value || '');
    const fromText = String(from || '').trim();
    const toText = String(to || '');
    if (!fromText) return source;
    const pattern = new RegExp(this.escapeRegExp(fromText), 'gi');
    return source.replace(pattern, toText);
  }

  private parsePathSegments(path: string): Array<string | number> {
    const source = String(path || '').trim();
    if (!source) return [];
    const segments: Array<string | number> = [];
    const pattern = /([^[.\]]+)|\[(.*?)\]/g;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(source))) {
      const dotToken = String(match[1] || '').trim();
      const bracketToken = String(match[2] || '').trim();
      const token = dotToken || bracketToken;
      if (!token) continue;
      if (/^\d+$/.test(token)) {
        segments.push(Number(token));
      } else {
        segments.push(token);
      }
    }
    return segments;
  }

  private normalizeConfigPathSegments(path: string): Array<string | number> {
    const segments = this.parsePathSegments(path);
    if (!segments.length) return [];
    const first = String(segments[0] ?? '').trim().toLowerCase();
    if (first === 'config') return segments.slice(1);
    return segments;
  }

  private normalizePathKeyedObject(value: any): Record<string, any> {
    const source = value && typeof value === 'object' ? value : {};
    const normalized: Record<string, any> = {};
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = String(rawKey || '').trim();
      if (!key) continue;
      if (key.includes('.') || key.includes('[')) {
        const segments = this.parsePathSegments(key);
        if (segments.length) {
          this.setBySegments(normalized, segments, rawValue);
          continue;
        }
      }
      normalized[key] = rawValue;
    }
    return normalized;
  }

  private objectContainsText(value: any, needle: string): boolean {
    const text = String(needle || '').trim().toLowerCase();
    if (!text) return false;
    if (typeof value === 'string') {
      return value.toLowerCase().includes(text);
    }
    if (Array.isArray(value)) {
      return value.some((entry) => this.objectContainsText(entry, text));
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some((entry) => this.objectContainsText(entry, text));
    }
    return false;
  }

  private collectStringPayloadEntries(value: any, basePath: string = ''): Array<{ path: string; value: string }> {
    if (typeof value === 'string') {
      return [{ path: basePath || 'value', value }];
    }
    if (Array.isArray(value)) {
      const output: Array<{ path: string; value: string }> = [];
      for (let index = 0; index < value.length; index += 1) {
        const nextPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
        output.push(...this.collectStringPayloadEntries(value[index], nextPath));
      }
      return output;
    }
    if (value && typeof value === 'object') {
      const output: Array<{ path: string; value: string }> = [];
      for (const [rawKey, nestedValue] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        const nextPath = basePath ? `${basePath}.${key}` : key;
        output.push(...this.collectStringPayloadEntries(nestedValue, nextPath));
      }
      return output;
    }
    return [];
  }

  private pathsLikelySame(left: string, right: string): boolean {
    const a = String(left || '').trim().toLowerCase();
    const b = String(right || '').trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) return true;
    return false;
  }

  private getBySegments(source: any, segments: Array<string | number>): any {
    let cursor = source;
    for (const segment of segments) {
      if (cursor === null || cursor === undefined) return undefined;
      cursor = cursor[segment as any];
    }
    return cursor;
  }

  private setBySegments(target: any, segments: Array<string | number>, value: any): void {
    if (!target || typeof target !== 'object' || !segments.length) return;
    let cursor: any = target;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const next = segments[i + 1];
      if (cursor[segment as any] === undefined || cursor[segment as any] === null) {
        cursor[segment as any] = typeof next === 'number' ? [] : {};
      }
      cursor = cursor[segment as any];
    }
    const leaf = segments[segments.length - 1];
    cursor[leaf as any] = value;
  }

  private deepClone<T>(value: T): T {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  private collectContentSearchMatches(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>
  ): Array<{ collectionSlug: string; recordId: string | number; field: string; value: string }> {
    const matches: Array<{ collectionSlug: string; recordId: string | number; field: string; value: string }> = [];
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      if (String(item?.tool || '') !== 'content.search_text') continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      const list = Array.isArray((output as any).matches) ? (output as any).matches : [];
      for (const entry of list) {
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

  private collectConfigSearchMatches(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    toolName: 'plugins.settings.search_text' | 'themes.config.search_text',
  ): Array<{ slug: string; path: string; value: string }> {
    const matches: Array<{ slug: string; path: string; value: string }> = [];
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      if (String(item?.tool || '') !== toolName) continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      const list = Array.isArray((output as any).matches) ? (output as any).matches : [];
      for (const entry of list) {
        const slug = String((entry as any)?.slug || '').trim();
        const path = String((entry as any)?.path || '').trim();
        const value = String((entry as any)?.value || '');
        if (!slug || !path) continue;
        matches.push({ slug, path, value });
      }
    }
    return matches;
  }

  private filterReplaceActionsByEvidence(
    actions: AssistantAction[],
    replaceInstruction: { from: string; to: string },
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
  ): AssistantAction[] {
    const pluginMatches = this.collectConfigSearchMatches(toolResults, 'plugins.settings.search_text');
    const themeMatches = this.collectConfigSearchMatches(toolResults, 'themes.config.search_text');
    const contentMatches = this.collectContentSearchMatches(toolResults);
    const pluginMatchCount = pluginMatches.length;
    const themeMatchCount = themeMatches.length;

    return (Array.isArray(actions) ? actions : []).filter((action) => {
      if (!action || action.type !== 'mcp_call') return true;
      const tool = String(action.tool || '').trim();
      if (tool === 'plugins.settings.update') {
        if (pluginMatchCount === 0) return false;
        const payload = action.input && typeof action.input === 'object'
          ? ((action.input as any).data && typeof (action.input as any).data === 'object'
              ? (action.input as any).data
              : (action.input as any).config && typeof (action.input as any).config === 'object'
                ? (action.input as any).config
                : null)
          : null;
        if (!payload || !this.objectContainsText(payload, replaceInstruction.to)) return false;
      }
      if (tool === 'themes.config.update') {
        if (themeMatchCount === 0) return false;
        const payload = action.input && typeof action.input === 'object'
          ? ((action.input as any).data && typeof (action.input as any).data === 'object'
              ? (action.input as any).data
              : (action.input as any).config && typeof (action.input as any).config === 'object'
                ? (action.input as any).config
                : null)
          : null;
        if (!payload || !this.objectContainsText(payload, replaceInstruction.to)) return false;
      }
      if (tool === 'content.update') {
        const payloadRaw = action.input && typeof action.input === 'object' && (action.input as any).data && typeof (action.input as any).data === 'object'
          ? (action.input as any).data
          : null;
        const payload = payloadRaw ? this.normalizePathKeyedObject(payloadRaw) : null;
        if (!payload || !this.objectContainsText(payload, replaceInstruction.to)) return false;
        const collectionSlug = String((action.input as any)?.collectionSlug || '').trim();
        const recordId = (action.input as any)?.id;
        if (!collectionSlug || recordId === undefined || recordId === null) return false;
        const payloadEntries = this.collectStringPayloadEntries(payload).filter((entry) =>
          this.objectContainsText(entry.value, replaceInstruction.to),
        );
        if (!payloadEntries.length) return false;
        if (contentMatches.length === 0) return false;
        const hasEvidence = payloadEntries.some((entry) =>
          contentMatches.some(
            (match) =>
              String(match.collectionSlug || '').trim() === collectionSlug &&
              String(match.recordId) === String(recordId) &&
              this.pathsLikelySame(match.field, entry.path),
          ),
        );
        if (!hasEvidence) return false;
      }
      return true;
    });
  }

  private async stageFallbackReplaceActions(
    message: string,
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    mcpBridge: McpBridge,
  ): Promise<AssistantAction[]> {
    const replaceInstruction = this.parseReplaceInstruction(message);
    if (!replaceInstruction) return [];
    const grouped = new Map<string, Array<{ collectionSlug: string; recordId: string | number; field: string; value: string }>>();
    for (const match of this.collectContentSearchMatches(toolResults)) {
      const key = `${match.collectionSlug}::${String(match.recordId)}`;
      const list = grouped.get(key) || [];
      list.push(match);
      grouped.set(key, list);
    }

    const staged: AssistantAction[] = [];

    if (typeof this.options.resolveContent === 'function') {
      for (const [groupKey, groupMatches] of grouped.entries()) {
        const [collectionSlug, recordIdRaw] = groupKey.split('::');
        const collection = this.options.findCollectionBySlug(collectionSlug);
        if (!collection) continue;

        const recordId: string | number = /^\d+$/.test(String(recordIdRaw || ''))
          ? Number(recordIdRaw)
          : recordIdRaw;

        const existing = await this.options
          .resolveContent(collection, { id: recordId }, { dryRun: true })
          .catch(() => null);
        if (!existing || typeof existing !== 'object') continue;

        const updatedRecord = this.deepClone(existing);
        const changedRoots = new Set<string>();

        for (const match of groupMatches) {
          const segments = this.parsePathSegments(match.field);
          if (!segments.length) continue;
          const root = String(segments[0] ?? '').trim();
          if (!root) continue;

          const currentValue = this.getBySegments(updatedRecord, segments);
          if (typeof currentValue !== 'string') continue;
          const replacedValue = this.replaceTextInsensitive(
            currentValue,
            replaceInstruction.from,
            replaceInstruction.to,
          );
          if (replacedValue === currentValue) continue;

          this.setBySegments(updatedRecord, segments, replacedValue);
          changedRoots.add(root);
        }

        for (const root of changedRoots) {
          const beforeRoot = (existing as any)?.[root];
          const afterRoot = (updatedRecord as any)?.[root];
          if (JSON.stringify(beforeRoot) === JSON.stringify(afterRoot)) continue;
          staged.push({
            type: 'mcp_call',
            tool: 'content.update',
            input: {
              collectionSlug: collection.slug,
              id: recordId,
              data: { [root]: afterRoot },
            },
          });
        }
      }
    }

    const pluginMatches = this.collectConfigSearchMatches(toolResults, 'plugins.settings.search_text');
    const pluginPathsBySlug = new Map<string, Set<string>>();
    for (const match of pluginMatches) {
      const set = pluginPathsBySlug.get(match.slug) || new Set<string>();
      set.add(match.path);
      pluginPathsBySlug.set(match.slug, set);
    }
    for (const [slug, paths] of pluginPathsBySlug.entries()) {
      const configResult = await mcpBridge.call({
        tool: 'plugins.settings.get',
        input: { slug },
        context: { dryRun: true },
      });
      if (!configResult?.ok) continue;
      const output = configResult.output && typeof configResult.output === 'object' ? configResult.output : {};
      const currentConfig = output?.config && typeof output.config === 'object' ? output.config : {};
      const patch: Record<string, any> = {};
      let hasChange = false;
      for (const path of paths.values()) {
        const segments = this.normalizeConfigPathSegments(path);
        if (!segments.length) continue;
        const currentValue = this.getBySegments(currentConfig, segments);
        if (typeof currentValue !== 'string') continue;
        const replacedValue = this.replaceTextInsensitive(currentValue, replaceInstruction.from, replaceInstruction.to);
        if (replacedValue === currentValue) continue;
        this.setBySegments(patch, segments, replacedValue);
        hasChange = true;
      }
      if (!hasChange || Object.keys(patch).length === 0) continue;
      staged.push({
        type: 'mcp_call',
        tool: 'plugins.settings.update',
        input: {
          slug,
          merge: true,
          data: patch,
        },
      });
    }

    const themeMatches = this.collectConfigSearchMatches(toolResults, 'themes.config.search_text');
    const themePathsBySlug = new Map<string, Set<string>>();
    for (const match of themeMatches) {
      const set = themePathsBySlug.get(match.slug) || new Set<string>();
      set.add(match.path);
      themePathsBySlug.set(match.slug, set);
    }
    for (const [slug, paths] of themePathsBySlug.entries()) {
      const configResult = await mcpBridge.call({
        tool: 'themes.config.get',
        input: { slug },
        context: { dryRun: true },
      });
      if (!configResult?.ok) continue;
      const output = configResult.output && typeof configResult.output === 'object' ? configResult.output : {};
      const currentConfig = output?.config && typeof output.config === 'object' ? output.config : {};
      const patch: Record<string, any> = {};
      let hasChange = false;
      for (const path of paths.values()) {
        const segments = this.normalizeConfigPathSegments(path);
        if (!segments.length) continue;
        const currentValue = this.getBySegments(currentConfig, segments);
        if (typeof currentValue !== 'string') continue;
        const replacedValue = this.replaceTextInsensitive(currentValue, replaceInstruction.from, replaceInstruction.to);
        if (replacedValue === currentValue) continue;
        this.setBySegments(patch, segments, replacedValue);
        hasChange = true;
      }
      if (!hasChange || Object.keys(patch).length === 0) continue;
      staged.push({
        type: 'mcp_call',
        tool: 'themes.config.update',
        input: {
          slug,
          merge: true,
          data: patch,
        },
      });
    }

    return staged;
  }

  private inferSearchQueryFromPrompt(prompt: string): string {
    const source = String(prompt || '').trim();
    if (!source) return '';

    const replacePattern = /replace\s+["']([^"']+)["']\s+(?:with|to)\s+["'][^"']+["']/i;
    const replaceMatch = source.match(replacePattern);
    if (replaceMatch?.[1]) {
      return String(replaceMatch[1]).trim();
    }

    const quoted = source.match(/["']([^"']+)["']/);
    if (quoted?.[1]) {
      return String(quoted[1]).trim();
    }

    const normalized = source
      .replace(/\b(update|change|rename|replace|from|to|with|please|can you|i need to)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return '';
    const words = normalized.split(' ').slice(0, 4).join(' ').trim();
    return words;
  }

  private textMatchesQuery(value: string, queryLower: string, queryTokens: string[]): boolean {
    const normalized = this.normalizeSearchText(value);
    if (!normalized) return false;
    if (queryLower && normalized.includes(queryLower)) return true;
    if (!queryTokens.length) return false;
    return queryTokens.every((token) => this.tokenVariants(token).some((variant) => normalized.includes(variant)));
  }

  private collectStringMatches(
    value: any,
    queryLower: string,
    queryTokens: string[],
    basePath: string,
    depth: number = 0,
    maxDepth: number = 5
  ): Array<{ path: string; value: string }> {
    if (depth > maxDepth) return [];
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
      if (!this.textMatchesQuery(value, queryLower, queryTokens)) return [];
      return [{ path: basePath || 'value', value }];
    }

    if (Array.isArray(value)) {
      const output: Array<{ path: string; value: string }> = [];
      for (let index = 0; index < value.length; index += 1) {
        const nextPath = `${basePath}[${index}]`;
        output.push(...this.collectStringMatches(value[index], queryLower, queryTokens, nextPath, depth + 1, maxDepth));
      }
      return output;
    }

    if (typeof value === 'object') {
      const output: Array<{ path: string; value: string }> = [];
      for (const [rawKey, nestedValue] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        if (key.startsWith('_')) continue;
        const keySegment = this.isPotentialLocaleKey(key) ? `[${key}]` : key;
        const nextPath = basePath ? `${basePath}.${keySegment}` : keySegment;
        output.push(...this.collectStringMatches(nestedValue, queryLower, queryTokens, nextPath, depth + 1, maxDepth));
      }
      return output;
    }

    return [];
  }

  private readPathValue(source: any, path: string): any {
    const safeSource = source && typeof source === 'object' ? source : {};
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return undefined;

    const tokens = normalizedPath
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .map((token) => token.trim())
      .filter(Boolean);

    let cursor: any = safeSource;
    for (const token of tokens) {
      if (cursor === null || cursor === undefined) return undefined;
      cursor = cursor[token];
    }
    return cursor;
  }

  private validateWritableSettingKey(key: string, existing: AssistantSettingValue): string | null {
    const normalized = String(key || '').trim();
    if (!normalized) return 'Missing setting key';
    if (normalized.startsWith('_')) {
      return `Setting key "${normalized}" is reserved/internal and cannot be updated via assistant.`;
    }
    if (!/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
      return `Setting key "${normalized}" contains unsupported characters.`;
    }
    if (existing?.found) return null;

    if (
      normalized.startsWith('assistant.') ||
      normalized.startsWith('ai.') ||
      normalized.startsWith('forge.')
    ) {
      return null;
    }

    return `Unknown setting key "${normalized}". Use content records, plugin settings, or theme config updates for copy/config changes.`;
  }

  private hasSelectorValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return String(value).trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  }

  private hasUsableContentUpdateSelector(input: Record<string, any>): boolean {
    if (!input || typeof input !== 'object') return false;
    if (this.hasSelectorValue((input as any).id)) return true;
    if (this.hasSelectorValue((input as any).recordId)) return true;
    if (this.hasSelectorValue((input as any).slug)) return true;
    if (this.hasSelectorValue((input as any).entrySlug)) return true;
    if (this.hasSelectorValue((input as any).lookupSlug)) return true;
    if (this.hasSelectorValue((input as any).slugValue)) return true;
    if (this.hasSelectorValue((input as any).permalink)) return true;
    if (this.hasSelectorValue((input as any).path)) return true;
    if (this.hasSelectorValue((input as any).where)) return true;
    return false;
  }

  private hasWritablePayload(input: Record<string, any>): boolean {
    if (!input || typeof input !== 'object') return false;
    const payload = (input as any).data;
    if (!payload || typeof payload !== 'object') return false;
    return Object.keys(payload).length > 0;
  }

  private buildToolResultsFallbackMessage(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    currentMessage: string,
  ): string {
    const safeResults = Array.isArray(toolResults) ? toolResults : [];
    if (!safeResults.length) {
      return currentMessage || 'No additional results were returned.';
    }

    const lines: string[] = ["Here's what I found:"];
    let foundMatches = false;
    const summaryByTool = new Map<string, { matches: number; records: number; failed: number; errors: string[]; samples: string[] }>();
    const seenSampleLines = new Set<string>();

    for (const item of safeResults) {
      const tool = String(item?.tool || 'tool').trim() || 'tool';
      const current = summaryByTool.get(tool) || { matches: 0, records: 0, failed: 0, errors: [], samples: [] };
      const callResult = item?.result || {};
      if (!callResult?.ok) {
        current.failed += 1;
        const errorText = String(callResult?.error || 'unknown error').trim();
        if (errorText && !current.errors.includes(errorText)) current.errors.push(errorText);
        summaryByTool.set(tool, current);
        continue;
      }

      const output = callResult?.output && typeof callResult.output === 'object' ? callResult.output : {};
      const matches = Array.isArray((output as any).matches) ? (output as any).matches : [];
      const totalMatches = Number((output as any).totalMatches ?? matches.length ?? 0);
      if (Number.isFinite(totalMatches) && totalMatches > current.matches) {
        current.matches = totalMatches;
      }

      if (Array.isArray((output as any).docs)) {
        const totalDocs = Number((output as any).totalDocs ?? (output as any).docs.length ?? 0);
        if (Number.isFinite(totalDocs) && totalDocs > current.records) {
          current.records = totalDocs;
        }
      }

      for (const match of matches.slice(0, 4)) {
        if (!match || typeof match !== 'object') continue;
        const collectionSlug = String((match as any).collectionSlug || '').trim();
        const slug = String((match as any).slug || '').trim();
        const path = String((match as any).path || (match as any).field || '').trim();
        const value = String((match as any).value || '').trim();
        const label = collectionSlug || slug || 'record';
        let line = '';
        if (path && value) line = `${label}.${path}: "${value}"`;
        else if (path) line = `${label}.${path}`;
        else if (value) line = `${label}: "${value}"`;
        if (line && !seenSampleLines.has(line)) {
          seenSampleLines.add(line);
          current.samples.push(line);
        }
      }

      summaryByTool.set(tool, current);
    }

    for (const [tool, summary] of summaryByTool.entries()) {
      const label = this.formatToolLabel(tool);
      if (summary.matches > 0) {
        foundMatches = true;
        lines.push(`- **${label}**: ${summary.matches} match${summary.matches === 1 ? '' : 'es'} found.`);
      } else if (summary.failed > 0) {
        if (foundMatches) continue;
        lines.push(`- **${label}**: failed (${summary.errors.join(' | ') || 'unknown error'}).`);
      } else if (summary.records > 0) {
        lines.push(`- **${label}**: ${summary.records} records returned.`);
      } else {
        if (foundMatches) continue;
        lines.push(`- **${label}**: no matches.`);
      }
    }

    const sampleLines = Array.from(summaryByTool.values())
      .flatMap((summary) => summary.samples)
      .slice(0, 5);
    for (const line of sampleLines) {
      lines.push(`  ${line}`);
    }

    lines.push(
      foundMatches
        ? 'I can now stage exact update actions for preview and approval.'
        : 'No matches found yet. I can broaden the query or include additional collections/plugins/themes.'
    );

    return lines.join('\n');
  }

  private toolMatchStatsByTool(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>
  ): Map<string, number> {
    const stats = new Map<string, number>();
    for (const item of Array.isArray(toolResults) ? toolResults : []) {
      const tool = String(item?.tool || '').trim();
      if (!tool) continue;
      const output = item?.result?.output && typeof item.result.output === 'object' ? item.result.output : {};
      const matches = Array.isArray((output as any).matches) ? (output as any).matches : [];
      const totalMatches = Number((output as any).totalMatches ?? matches.length ?? 0);
      const safeTotal = Number.isFinite(totalMatches) && totalMatches > 0 ? totalMatches : 0;
      const current = Number(stats.get(tool) || 0);
      if (safeTotal > current) stats.set(tool, safeTotal);
      else if (!stats.has(tool)) stats.set(tool, current);
    }
    return stats;
  }

  private shouldUseToolSummaryOverride(
    currentMessage: string,
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>
  ): boolean {
    const message = String(currentMessage || '').trim().toLowerCase();
    if (!message) return true;
    if (this.isInterimPlanningMessage(message) || /no response generated/.test(message)) return true;

    const stats = this.toolMatchStatsByTool(toolResults);
    const hasAnyMatches = Array.from(stats.values()).some((value) => Number(value) > 0);
    if (!hasAnyMatches) return false;

    if (/\bno matches\b/.test(message)) return true;

    const mentionsOnlyPluginSettings =
      message.includes('plugin settings') &&
      !message.includes('content') &&
      !message.includes('theme');

    if (mentionsOnlyPluginSettings) {
      const contentMatches = Number(stats.get('content.search_text') || 0);
      const themeMatches = Number(stats.get('themes.config.search_text') || 0);
      if (contentMatches > 0 || themeMatches > 0) return true;
    }

    return false;
  }

  private async filterUnsafeStagedActions(
    actions: AssistantAction[],
    availableTools: AssistantToolSummary[]
  ): Promise<AssistantAction[]> {
    const toolMap = new Map(
      (availableTools || [])
        .map((tool) => [String(tool?.tool || '').trim(), !!tool?.readOnly] as const)
        .filter(([tool]) => Boolean(tool))
    );
    const filtered: AssistantAction[] = [];

    for (const action of actions) {
      if (!action || typeof action !== 'object') continue;

      if (action.type === 'create_content') {
        const collectionSlug = String(action.collectionSlug || '').trim();
        const payload = action.data && typeof action.data === 'object' ? action.data : null;
        if (!collectionSlug || !payload || Object.keys(payload).length === 0) continue;
        if (!this.options.findCollectionBySlug(collectionSlug)) continue;
        filtered.push(action);
        continue;
      }

      if (action.type === 'update_setting') {
        const key = String(action.key || '').trim();
        const existing = await this.options.getSetting(key);
        const validationError = this.validateWritableSettingKey(key, existing);
        if (validationError) continue;
        filtered.push(action);
        continue;
      }

      if (action.type === 'mcp_call') {
        const tool = String(action.tool || '').trim();
        const input = action.input && typeof action.input === 'object' ? action.input : {};
        if (!tool || !toolMap.has(tool)) continue;
        if (toolMap.get(tool) === true) continue;

        if (tool === 'content.update') {
          if (!this.hasUsableContentUpdateSelector(input) || !this.hasWritablePayload(input)) {
            continue;
          }

          const collectionSource = String((input as any)?.collectionSlug || (input as any)?.slug || '').trim();
          const collection = this.options.findCollectionBySlug(collectionSource);
          if (!collection) {
            continue;
          }

          if (typeof this.options.resolveContent === 'function') {
            const selector = {
              id: (input as any)?.id ?? (input as any)?.recordId,
              slug: (input as any)?.entrySlug
                ? String((input as any).entrySlug)
                : (input as any)?.lookupSlug
                  ? String((input as any).lookupSlug)
                  : (input as any)?.slugValue
                    ? String((input as any).slugValue)
                    : (input as any)?.slug
                      ? String((input as any).slug)
                      : undefined,
              permalink: (input as any)?.permalink
                ? String((input as any).permalink)
                : (input as any)?.path
                  ? String((input as any).path)
                  : undefined,
              where: (input as any)?.where && typeof (input as any).where === 'object' ? (input as any).where : undefined,
            };

            const existing = await this.options.resolveContent(collection, selector, { dryRun: true }).catch(() => null);
            if (!existing || typeof existing !== 'object') {
              continue;
            }

            const primaryKey = String((collection as any)?.raw?.primaryKey || 'id');
            const resolvedId = (existing as any)?.[primaryKey] ?? (existing as any)?.id;
            if (resolvedId === undefined || resolvedId === null || String(resolvedId).trim() === '') {
              continue;
            }

            const payloadRaw = (input as any)?.data && typeof (input as any).data === 'object' ? (input as any).data : {};
            const payload = this.normalizePathKeyedObject(payloadRaw);
            if (!payload || Object.keys(payload).length === 0) {
              continue;
            }
            filtered.push({
              ...action,
              tool,
              input: {
                collectionSlug: collection.slug,
                id: resolvedId,
                data: payload,
              },
            });
            continue;
          }
        }

        if (tool === 'settings.set') {
          const key = String((input as any)?.key || '').trim();
          const existing = await this.options.getSetting(key);
          const validationError = this.validateWritableSettingKey(key, existing);
          if (validationError) continue;
        }

        if (tool === 'plugins.settings.update') {
          const pluginSlug = String((input as any)?.slug || '').trim();
          let patch = (input as any)?.config && typeof (input as any).config === 'object'
            ? this.deepClone((input as any).config)
            : (input as any)?.data && typeof (input as any).data === 'object'
              ? this.deepClone((input as any).data)
              : {};
          if ((!patch || Object.keys(patch).length === 0) && String((input as any)?.key || '').trim() && (input as any)?.value !== undefined) {
            patch = {};
            const segments = this.normalizeConfigPathSegments(String((input as any).key));
            if (segments.length) {
              this.setBySegments(patch, segments, (input as any).value);
            }
          }
          if (!pluginSlug || !patch || typeof patch !== 'object' || Object.keys(patch).length === 0) continue;
          filtered.push({
            ...action,
            tool,
            input: {
              slug: pluginSlug,
              merge: (input as any)?.merge !== false,
              data: patch,
            },
          });
          continue;
        }

        if (tool === 'themes.config.update') {
          const themeSlug = String((input as any)?.slug || '').trim();
          let patch = (input as any)?.config && typeof (input as any).config === 'object'
            ? this.deepClone((input as any).config)
            : (input as any)?.data && typeof (input as any).data === 'object'
              ? this.deepClone((input as any).data)
              : {};
          if ((!patch || Object.keys(patch).length === 0) && String((input as any)?.key || '').trim() && (input as any)?.value !== undefined) {
            patch = {};
            const segments = this.normalizeConfigPathSegments(String((input as any).key));
            if (segments.length) {
              this.setBySegments(patch, segments, (input as any).value);
            }
          }
          if (!themeSlug || !patch || typeof patch !== 'object' || Object.keys(patch).length === 0) continue;
          filtered.push({
            ...action,
            tool,
            input: {
              slug: themeSlug,
              merge: (input as any)?.merge !== false,
              data: patch,
            },
          });
          continue;
        }

        filtered.push(action);
        continue;
      }
    }

    return filtered;
  }

  sanitizeActions(actions: any[]): AssistantAction[] {
    return (Array.isArray(actions) ? actions : [])
      .filter((action: any) => action && typeof action === 'object')
      .map((action: any) => ({
        type: String(action.type || '').trim(),
        collectionSlug: action.collectionSlug ? String(action.collectionSlug) : undefined,
        data: action.data && typeof action.data === 'object' ? action.data : undefined,
        key: action.key ? String(action.key) : undefined,
        value: action.value !== undefined ? String(action.value) : undefined,
        reason: action.reason ? String(action.reason) : undefined,
        tool: action.tool ? String(action.tool) : undefined,
        input: action.input && typeof action.input === 'object' ? action.input : undefined,
      }))
      .filter((action: any) => ['create_content', 'update_setting', 'mcp_call'].includes(action.type)) as AssistantAction[];
  }

  private async buildMcpBridge(dryRun: boolean): Promise<McpBridge> {
    const tools: McpToolDefinition[] = [
      {
        tool: 'collections.list',
        readOnly: true,
        description: 'List available content collections.',
        handler: async () => ({
          collections: this.options.getCollections().map((collection) => ({
            slug: collection.slug,
            shortSlug: collection.shortSlug,
            label: collection.label,
            pluginSlug: collection.pluginSlug,
          })),
        }),
      },
      {
        tool: 'collections.resolve',
        readOnly: true,
        description: 'Resolve a collection by slug, short slug, or unprefixed slug.',
        handler: async (input) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const collection = this.options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          return {
            slug: collection.slug,
            shortSlug: collection.shortSlug,
            label: collection.label,
            pluginSlug: collection.pluginSlug,
          };
        },
      },
      {
        tool: 'content.list',
        readOnly: true,
        description: 'List content items from a collection.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const collection = this.options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          if (typeof this.options.listContent !== 'function') {
            throw new Error('content.list is not available in this runtime.');
          }

          const limit = Math.min(100, Math.max(1, Number(input?.limit || 20)));
          const offset = Math.max(0, Number(input?.offset || 0));
          const result = await this.options.listContent(collection, { limit, offset, context: context || {} });
          return {
            collectionSlug: collection.slug,
            docs: Array.isArray(result?.docs) ? result.docs : [],
            totalDocs: Number(result?.totalDocs || 0),
            limit,
            offset,
          };
        },
      },
      {
        tool: 'content.search_text',
        readOnly: true,
        description: 'Search text across content collections, including localized map fields.',
        handler: async (input, context) => {
          if (typeof this.options.listContent !== 'function') {
            throw new Error('content.search_text is not available in this runtime.');
          }

          const query = String(input?.query || input?.text || '').trim();
          if (!query) throw new Error('Missing search query');
          const queryLower = this.normalizeSearchText(query);
          const queryTokens = this.tokenizeSearchQuery(query);

          const requestedCollectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const maxDocs = Math.min(200, Math.max(1, Number(input?.limit || 80)));
          const maxMatches = Math.min(200, Math.max(1, Number(input?.maxMatches || 40)));
          const requestedFields = Array.isArray(input?.fields)
            ? input.fields.map((field: any) => String(field || '').trim()).filter(Boolean)
            : [];

          const scopedCollection = requestedCollectionSlug
            ? this.options.findCollectionBySlug(requestedCollectionSlug)
            : null;
          if (requestedCollectionSlug && !scopedCollection) {
            throw new Error(`Unknown collection: ${requestedCollectionSlug}`);
          }

          const targetCollections = scopedCollection
            ? [scopedCollection]
            : this.options.getCollections();

          const matches: Array<{
            collectionSlug: string;
            recordId: string | number | null;
            field: string;
            value: string;
          }> = [];

          for (const collection of targetCollections) {
            if (matches.length >= maxMatches) break;

            const listResult = await this.options.listContent(collection, {
              limit: maxDocs,
              offset: 0,
              context: context || {},
            });
            const docs = Array.isArray(listResult?.docs) ? listResult.docs : [];
            const primaryKey = String(collection.raw?.primaryKey || 'id');

            for (const doc of docs) {
              if (matches.length >= maxMatches) break;
              if (!doc || typeof doc !== 'object') continue;

              const recordId = (doc as any)?.[primaryKey] ?? (doc as any)?.id ?? null;

              const fieldEntries: Array<{ fieldPath: string; fieldValue: any }> = [];
              if (requestedFields.length) {
                for (const field of requestedFields) {
                  fieldEntries.push({
                    fieldPath: field,
                    fieldValue: this.readPathValue(doc, field),
                  });
                }
              } else {
                for (const [rawField, rawValue] of Object.entries(doc)) {
                  const field = String(rawField || '').trim();
                  if (!field || field.startsWith('_')) continue;
                  fieldEntries.push({ fieldPath: field, fieldValue: rawValue });
                }
              }

              for (const fieldEntry of fieldEntries) {
                if (matches.length >= maxMatches) break;
                const found = this.collectStringMatches(
                  fieldEntry.fieldValue,
                  queryLower,
                  queryTokens,
                  fieldEntry.fieldPath,
                  0,
                  5
                );

                for (const item of found) {
                  if (matches.length >= maxMatches) break;
                  matches.push({
                    collectionSlug: collection.slug,
                    recordId,
                    field: item.path,
                    value: item.value.length > 240 ? `${item.value.slice(0, 240)}...` : item.value,
                  });
                }
              }
            }
          }

          return {
            query,
            matches,
            totalMatches: matches.length,
            truncated: matches.length >= maxMatches,
          };
        },
      },
      {
        tool: 'content.create',
        readOnly: false,
        description: 'Create a content item in a collection.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const payload = input?.data && typeof input.data === 'object' ? input.data : {};
          const collection = this.options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);

          const effectiveDryRun = context?.dryRun === true || dryRun;
          if (effectiveDryRun) {
            const previewPath = this.resolveRecordPreviewPath(payload, collection.slug);
            return {
              dryRun: true,
              action: {
                type: 'create_content',
                collectionSlug: collection.slug,
                data: payload,
              },
              preview: payload,
              visualPreview: {
                path: previewPath,
                title: this.resolveRecordPreviewTitle(payload),
              },
            };
          }

          const created = await this.options.createContent(collection, payload, context || {});
          const createdPreviewPath = this.resolveRecordPreviewPath(created, collection.slug);
          return {
            dryRun: false,
            action: {
              type: 'create_content',
              collectionSlug: collection.slug,
              data: payload,
            },
            id: created?.id,
            item: created,
            visualPreview: {
              path: createdPreviewPath,
              title: this.resolveRecordPreviewTitle(created),
            },
          };
        },
      },
      {
        tool: 'content.resolve',
        readOnly: true,
        description: 'Resolve a single content item by id, slug, permalink, or where filters.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const collection = this.options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          if (typeof this.options.resolveContent !== 'function') {
            throw new Error('content.resolve is not available in this runtime.');
          }

          const selector = {
            id: input?.id ?? input?.recordId,
            slug: input?.entrySlug ? String(input.entrySlug) : input?.lookupSlug ? String(input.lookupSlug) : input?.slugValue ? String(input.slugValue) : input?.slug ? String(input.slug) : undefined,
            permalink: input?.permalink ? String(input.permalink) : input?.path ? String(input.path) : undefined,
            where: input?.where && typeof input.where === 'object' ? input.where : undefined,
          };
          const item = await this.options.resolveContent(collection, selector, context || {});
          return {
            collectionSlug: collection.slug,
            found: !!item,
            item: item || null,
          };
        },
      },
      {
        tool: 'content.update',
        readOnly: false,
        description: 'Update one content item by id/slug/permalink and return before/after preview.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const payload = input?.data && typeof input.data === 'object' ? input.data : {};
          const collection = this.options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          if (typeof this.options.resolveContent !== 'function' || typeof this.options.updateContent !== 'function') {
            throw new Error('content.update is not available in this runtime.');
          }

          const selector = {
            id: input?.id ?? input?.recordId,
            slug: input?.entrySlug ? String(input.entrySlug) : input?.lookupSlug ? String(input.lookupSlug) : input?.slugValue ? String(input.slugValue) : undefined,
            permalink: input?.permalink ? String(input.permalink) : input?.path ? String(input.path) : undefined,
            where: input?.where && typeof input.where === 'object' ? input.where : undefined,
          };
          const effectiveDryRun = context?.dryRun === true || dryRun;

          if (!payload || Object.keys(payload).length === 0) {
            return {
              dryRun: effectiveDryRun,
              skipped: true,
              reason: 'No values to set',
              action: {
                type: 'mcp_call',
                tool: 'content.update',
                input: {
                  collectionSlug: collection.slug,
                  ...selector,
                  data: payload,
                },
              },
            };
          }

          const existing = await this.options.resolveContent(collection, selector, context || {});
          if (!existing || typeof existing !== 'object') {
            throw new Error(`Record not found in "${collection.slug}" for the provided selector.`);
          }

          const primaryKey = String(collection.raw?.primaryKey || 'id');
          const targetId = (existing as any)?.[primaryKey] ?? selector.id;
          if (targetId === undefined || targetId === null || String(targetId).trim() === '') {
            throw new Error(`Resolved record in "${collection.slug}" does not expose primary key "${primaryKey}".`);
          }

          const changedFields = this.diffChangedFields(existing, payload);
          const before = this.pickRecordFields(existing, changedFields.map((entry) => entry.field));
          const beforePreviewPath = this.resolveRecordPreviewPath(existing, collection.slug);
          const afterDraftRecord = { ...(existing || {}), ...(payload || {}) };
          const afterDraftPreviewPath = this.resolveRecordPreviewPath(afterDraftRecord, collection.slug);

          if (changedFields.length === 0) {
            return {
              dryRun: effectiveDryRun,
              skipped: true,
              reason: 'No values to set',
              action: {
                type: 'mcp_call',
                tool: 'content.update',
                input: {
                  collectionSlug: collection.slug,
                  id: targetId,
                  data: payload,
                },
              },
              target: {
                collectionSlug: collection.slug,
                primaryKey,
                id: targetId,
              },
              changedFields: [],
              before: {},
              after: {},
              visualPreview: {
                beforePath: beforePreviewPath,
                afterPath: beforePreviewPath,
                beforeTitle: this.resolveRecordPreviewTitle(existing),
                afterTitle: this.resolveRecordPreviewTitle(existing),
              },
            };
          }

          if (effectiveDryRun) {
            const after = this.pickRecordFields(afterDraftRecord, changedFields.map((entry) => entry.field));
            return {
              dryRun: true,
              action: {
                type: 'mcp_call',
                tool: 'content.update',
                input: {
                  collectionSlug: collection.slug,
                  id: targetId,
                  data: payload,
                },
              },
              target: {
                collectionSlug: collection.slug,
                primaryKey,
                id: targetId,
              },
              changedFields,
              before,
              after,
              visualPreview: {
                beforePath: beforePreviewPath,
                afterPath: afterDraftPreviewPath,
                beforeTitle: this.resolveRecordPreviewTitle(existing),
                afterTitle: this.resolveRecordPreviewTitle(afterDraftRecord),
              },
            };
          }

          const updated = await this.options.updateContent(collection, targetId, payload, context || {});
          const after = this.pickRecordFields(updated, changedFields.map((entry) => entry.field));
          const updatedPreviewPath = this.resolveRecordPreviewPath(updated, collection.slug);
          return {
            dryRun: false,
            action: {
              type: 'mcp_call',
              tool: 'content.update',
              input: {
                collectionSlug: collection.slug,
                id: targetId,
                data: payload,
              },
            },
            target: {
              collectionSlug: collection.slug,
              primaryKey,
              id: targetId,
            },
            changedFields,
            before,
            after,
            item: updated,
            visualPreview: {
              beforePath: beforePreviewPath,
              afterPath: updatedPreviewPath,
              beforeTitle: this.resolveRecordPreviewTitle(existing),
              afterTitle: this.resolveRecordPreviewTitle(updated),
            },
          };
        },
      },
      {
        tool: 'settings.get',
        readOnly: true,
        description: 'Get value of a system meta setting key.',
        handler: async (input) => {
          const key = String(input?.key || '').trim();
          if (!key) throw new Error('Missing setting key');
          const existing = await this.options.getSetting(key);
          return {
            key,
            value: existing?.value ?? null,
            found: !!existing?.found,
          };
        },
      },
      {
        tool: 'settings.set',
        readOnly: false,
        description: 'Update value of a system meta setting key.',
        handler: async (input, context) => {
          const key = String(input?.key || '').trim();
          const value = String(input?.value ?? '').trim();
          if (!key) throw new Error('Missing setting key');

          const existing = await this.options.getSetting(key);
          const keyValidationError = this.validateWritableSettingKey(key, existing);
          if (keyValidationError) throw new Error(keyValidationError);
          const group = String(existing?.group || 'ai-assistant').trim() || 'ai-assistant';
          const effectiveDryRun = context?.dryRun === true || dryRun;

          if (effectiveDryRun) {
            return {
              dryRun: true,
              action: {
                type: 'update_setting',
                key,
                value,
              },
            };
          }

          await this.options.upsertSetting(key, value, group);
          return {
            dryRun: false,
            action: {
              type: 'update_setting',
              key,
              value,
            },
          };
        },
      },
      {
        tool: 'plugins.list',
        readOnly: true,
        description: 'List installed plugins and their activation state.',
        handler: async () => {
          const plugins = typeof this.options.getPlugins === 'function'
            ? this.options.getPlugins()
            : [];
          return {
            plugins: plugins.map((plugin) => ({
              slug: plugin.slug,
              name: plugin.name,
              version: plugin.version,
              state: plugin.state,
              capabilities: Array.isArray(plugin.capabilities) ? plugin.capabilities : [],
            })),
          };
        },
      },
      {
        tool: 'themes.list',
        readOnly: true,
        description: 'List installed themes and their activation state.',
        handler: async () => {
          const themes = typeof this.options.getThemes === 'function'
            ? this.options.getThemes()
            : [];
          return {
            themes: themes.map((theme) => ({
              slug: theme.slug,
              name: theme.name,
              version: theme.version,
              state: theme.state,
            })),
          };
        },
      },
      {
        tool: 'web.search',
        readOnly: true,
        description: 'Search the web for current information.',
        handler: async (input) => {
          const query = String(input?.query || input?.q || '').trim();
          if (!query) throw new Error('Missing search query');
          const maxResults = Math.min(10, Math.max(1, Number(input?.limit || 5)));
          const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

          const response = await fetch(endpoint, {
            headers: {
              Accept: 'application/json',
            },
          });
          if (!response.ok) {
            throw new Error(`web.search failed (${response.status})`);
          }

          const payload = await response.json().catch(() => ({} as any));
          const seen = new Set<string>();
          const items: Array<{ title: string; url: string; snippet: string }> = [];

          const pushItem = (titleRaw: any, urlRaw: any, snippetRaw: any) => {
            const title = String(titleRaw || '').trim();
            const url = String(urlRaw || '').trim();
            const snippet = String(snippetRaw || '').trim();
            if (!url || seen.has(url)) return;
            seen.add(url);
            items.push({
              title: title || url,
              url,
              snippet,
            });
          };

          pushItem(payload?.Heading, payload?.AbstractURL, payload?.AbstractText);

          const walkTopics = (topics: any[]) => {
            if (!Array.isArray(topics)) return;
            for (const topic of topics) {
              if (items.length >= maxResults) return;
              if (!topic || typeof topic !== 'object') continue;
              if (Array.isArray((topic as any).Topics)) {
                walkTopics((topic as any).Topics);
                continue;
              }
              pushItem((topic as any).Text, (topic as any).FirstURL, (topic as any).Text);
            }
          };

          walkTopics(Array.isArray(payload?.RelatedTopics) ? payload.RelatedTopics : []);
          return {
            query,
            results: items.slice(0, maxResults),
            source: 'duckduckgo',
          };
        },
      },
      {
        tool: 'web.fetch',
        readOnly: true,
        description: 'Fetch and summarize a page by URL (HTML, JSON, or plain text).',
        handler: async (input) => {
          const parsedUrl = this.normalizeWebUrl(String(input?.url || input?.href || ''));
          const timeoutMs = Math.min(20_000, Math.max(2_000, Number(input?.timeoutMs || 10_000)));
          const maxChars = Math.min(16_000, Math.max(400, Number(input?.maxChars || 4_000)));
          const maxLinks = Math.min(20, Math.max(0, Number(input?.maxLinks || 8)));

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          let response: Response;
          try {
            response = await fetch(parsedUrl.toString(), {
              signal: controller.signal,
              headers: {
                Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5',
              },
            });
          } catch (error: any) {
            if (error?.name === 'AbortError') {
              throw new Error(`web.fetch timed out after ${timeoutMs}ms`);
            }
            throw new Error(`web.fetch failed: ${String(error?.message || 'Request error')}`);
          } finally {
            clearTimeout(timer);
          }

          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          const rawBody = await response.text().catch(() => '');
          const finalUrl = String(response.url || parsedUrl.toString());
          const status = Number(response.status || 0);
          const isHtml = contentType.includes('text/html');
          const isJson = contentType.includes('application/json');

          let title: string | undefined;
          let extractedText = '';
          let links: string[] = [];

          if (isJson) {
            try {
              const parsed = JSON.parse(rawBody);
              extractedText = JSON.stringify(parsed, null, 2);
            } catch {
              extractedText = rawBody;
            }
          } else if (isHtml) {
            title = this.extractHtmlTitle(rawBody);
            extractedText = this.htmlToPlainText(rawBody);
            links = this.extractHtmlLinks(rawBody, finalUrl, maxLinks);
          } else {
            extractedText = rawBody;
          }

          const normalizedText = String(extractedText || '')
            .replace(/\s+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          const truncated = normalizedText.length > maxChars;
          const text = truncated ? `${normalizedText.slice(0, maxChars)}...` : normalizedText;

          return {
            url: finalUrl,
            requestedUrl: parsedUrl.toString(),
            status,
            ok: response.ok,
            contentType: contentType || null,
            title: title || null,
            text,
            truncated,
            links,
            fetchedAt: (this.options.now || (() => new Date().toISOString()))(),
          };
        },
      },
      {
        tool: 'system.now',
        readOnly: true,
        description: 'Get current server timestamp.',
        handler: async () => ({
          now: (this.options.now || (() => new Date().toISOString()))(),
        }),
      },
    ];

    const extraTools = await Promise.resolve(this.options.resolveAdditionalTools?.({ dryRun }) || []);
    if (Array.isArray(extraTools) && extraTools.length) {
      for (const tool of extraTools) {
        if (!tool || typeof tool !== 'object' || !tool.tool || typeof tool.handler !== 'function') continue;
        tools.push(tool);
      }
    }

    return createMcpBridge({ tools });
  }

  async listTools(dryRun: boolean = true): Promise<AssistantToolSummary[]> {
    const bridge = await this.buildMcpBridge(dryRun);
    return bridge.listTools();
  }

  async chat(input: AssistantChatInput): Promise<AssistantChatResult> {
    const aiClient = this.options.aiClient;
    if (!aiClient || typeof aiClient.chat !== 'function') {
      throw new Error('AI Assistant integration is not configured.');
    }

    const message = String(input?.message || '').trim();
    if (!message) {
      throw new Error('message is required');
    }

    const selectedSkillId = String(input?.skillId || 'general').trim().toLowerCase() || 'general';
    const availableSkills = await this.listSkills();
    const selectedSkill =
      availableSkills.find((skill) => skill.id === selectedSkillId) ||
      availableSkills.find((skill) => skill.id === 'general') ||
      availableSkills[0];

    const requestedMode = String(input?.agentMode || '').trim().toLowerCase();
    const normalizedRequestedMode =
      requestedMode === 'advanced' || requestedMode === 'plan' || requestedMode === 'agent'
        ? 'advanced'
        : requestedMode === 'basic' || requestedMode === 'chat' || requestedMode === 'auto'
          ? 'basic'
          : '';
    const modeFromSkill = selectedSkill?.defaultMode || 'chat';
    const agentMode = normalizedRequestedMode
      ? normalizedRequestedMode
      : modeFromSkill === 'chat'
        ? 'basic'
        : 'advanced';
    const maxIterations = Math.min(20, Math.max(1, Number(input?.maxIterations || 8)));
    const maxDurationMs = Math.min(120_000, Math.max(8_000, Number(input?.maxDurationMs || 35_000)));
    const sessionId = String(input?.sessionId || '').trim() || undefined;
    const planId = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const history = Array.isArray(input?.history) ? input.history : [];
    const normalizedHistory: AssistantMessage[] = history
      .slice(-12)
      .map((entry: any) => {
        const role = String(entry?.role || 'user').trim() as AssistantMessage['role'];
        return {
          role: VALID_HISTORY_ROLES.has(role) ? role : 'user',
          content: String(entry?.content || '').trim(),
        };
      })
      .filter((entry) => !!entry.content);

    const mcpBridge = await this.buildMcpBridge(true);
    const rawAvailableTools = mcpBridge.listTools();
    const allowedTools = Array.isArray(input?.allowedTools)
      ? input.allowedTools.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const allowedToolSet = allowedTools.length ? new Set(allowedTools) : null;
    const skillToolSet = Array.isArray(selectedSkill?.allowedTools) && selectedSkill?.allowedTools?.length
      ? new Set((selectedSkill.allowedTools || []).map((item) => String(item || '').trim()).filter(Boolean))
      : null;
    const isToolAllowed = (toolName: string) => {
      const name = String(toolName || '').trim();
      if (!name) return false;
      if (allowedToolSet && !allowedToolSet.has(name)) return false;
      if (skillToolSet && !skillToolSet.has(name)) return false;
      return true;
    };
    const availableTools = rawAvailableTools.filter((tool) => isToolAllowed(String(tool.tool || '').trim()));
    const replaceInstruction = this.parseReplaceInstruction(message);
    const collections = this.options.getCollections();
    const plugins = typeof this.options.getPlugins === 'function' ? this.options.getPlugins() : [];
    const themes = typeof this.options.getThemes === 'function' ? this.options.getThemes() : [];
    const runtimeContextLines = this.buildRuntimeContextLines(collections, plugins, themes, availableTools);
    const extensionPromptLines = await Promise.resolve(
      this.options.resolveAdditionalPromptLines?.({ collections, tools: availableTools }) || []
    );
    const normalizedExtensionPromptLines = Array.isArray(extensionPromptLines)
      ? extensionPromptLines.map((line) => String(line || '').trim()).filter(Boolean)
      : [];
    if (selectedSkill?.systemPromptPatch) {
      normalizedExtensionPromptLines.push(`Skill profile (${selectedSkill.label}): ${selectedSkill.systemPromptPatch}`);
    }
    const promptProfile = await Promise.resolve(
      this.options.resolvePromptProfile?.({ collections, plugins, tools: availableTools }) || {}
    );
    const customBasicSystemPrompt = String(promptProfile?.basicSystem || '').trim();
    const customAdvancedSystemPrompt = String(promptProfile?.advancedSystem || '').trim();

    if (this.isCapabilityOverviewIntent(message)) {
      const capabilityMessage = this.buildCapabilityOverviewMessage(collections, plugins, themes, availableTools);
      return {
        message: capabilityMessage,
        actions: [],
        model: '',
        agentMode: agentMode === 'advanced' ? 'advanced' : 'basic',
        done: true,
        traces: [],
        ui: this.buildUiHints({
          hasActions: false,
          loopCapReached: false,
          loopTimeLimitReached: false,
          done: true,
          selectedSkill,
        }),
        skill: selectedSkill,
        sessionId,
        iterations: 1,
        loopCapReached: false,
      };
    }

    const strategicAdviceIntent = this.isStrategicAdviceIntent(message);
    if (strategicAdviceIntent) {
      const systemPrompt = [
        customBasicSystemPrompt || this.buildDefaultBasicSystemPrompt(),
        ...runtimeContextLines,
        ...normalizedExtensionPromptLines,
        'User is asking for high-level strategy and efficiency improvements.',
        'Do not ask for collection/id/field unless the user explicitly asks to execute a concrete change.',
        'Return concise, prioritized recommendations with clear next steps.',
      ].join('\n');

      const response = await aiClient.chat({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...normalizedHistory,
          { role: 'user', content: message },
        ],
        json: false,
        temperature: 0.25,
        maxTokens: 900,
      });

      const strategicMessage = this.sanitizeUserFacingMessage(
        String(response?.content || '').trim() ||
          this.buildStrategicAdviceFallbackMessage(collections, plugins, themes, availableTools),
        'basic',
      );

      return {
        message: strategicMessage,
        actions: [],
        model: String(response?.model || ''),
        agentMode: 'basic',
        done: true,
        traces: [],
        ui: {
          canContinue: false,
          requiresApproval: false,
          suggestedMode: 'chat',
          showTechnicalDetailsDefault: false,
        },
        skill: selectedSkill,
        sessionId,
        iterations: 1,
        loopCapReached: false,
      };
    }

    if (agentMode !== 'advanced') {
      const systemPrompt = [
        customBasicSystemPrompt || this.buildDefaultBasicSystemPrompt(),
        ...runtimeContextLines,
        ...normalizedExtensionPromptLines,
      ].join('\n');

      const response = await aiClient.chat({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...normalizedHistory,
          { role: 'user', content: message },
        ],
        json: false,
        temperature: 0.25,
        maxTokens: 1200,
      });

      const basicMessage = this.sanitizeUserFacingMessage(
        String(response?.content || '').trim() || 'No response generated.',
        'basic',
      );
      const basicPlan = this.buildPlanArtifact({
        planId,
        goal: message,
        message: basicMessage,
        traces: [],
        actions: [],
        loopCapReached: false,
        loopTimeLimitReached: false,
        done: true,
        selectedSkill,
      });
      return {
        message: basicMessage,
        actions: [],
        model: String(response?.model || ''),
        agentMode: 'basic',
        done: true,
        traces: [],
        plan: basicPlan,
        ui: this.buildUiHints({
          hasActions: false,
          loopCapReached: false,
          loopTimeLimitReached: false,
          done: true,
          selectedSkill,
        }),
        skill: selectedSkill,
        sessionId,
        iterations: 1,
        loopCapReached: false,
      };
    }

    if (replaceInstruction) {
      const runSearchCalls = async (
        calls: Array<{ tool: string; input: Record<string, any> }>
      ): Promise<Array<{ tool: string; input: Record<string, any>; result: any }>> => {
        const results: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
        for (const call of calls) {
          if (!isToolAllowed(call.tool)) {
            results.push({
              tool: call.tool,
              input: { ...call.input },
              result: { ok: false, error: `Tool "${call.tool}" is not enabled for this run.` },
            });
            continue;
          }
          const result = await mcpBridge.call({
            tool: call.tool,
            input: { ...call.input },
            context: { dryRun: true },
          });
          results.push({
            tool: call.tool,
            input: { ...call.input },
            result,
          });
        }
        return results;
      };

      const deterministicCalls: Array<{ tool: string; input: Record<string, any> }> = [
        {
          tool: 'content.search_text',
          input: { query: replaceInstruction.from, maxMatches: 80 },
        },
        {
          tool: 'plugins.settings.search_text',
          input: { query: replaceInstruction.from, maxMatches: 80 },
        },
        {
          tool: 'themes.config.search_text',
          input: { query: replaceInstruction.from, maxMatches: 80 },
        },
      ];

      const deterministicResults = await runSearchCalls(deterministicCalls);

      let deterministicActions = await this.stageFallbackReplaceActions(message, deterministicResults, mcpBridge);
      if (deterministicActions.length) {
        deterministicActions = await this.filterUnsafeStagedActions(deterministicActions, availableTools);
        if (deterministicActions.length) {
            deterministicActions = this.filterReplaceActionsByEvidence(
              deterministicActions,
              replaceInstruction,
              deterministicResults,
            );
          }
      }

      const deterministicSummary = this.buildToolResultsFallbackMessage(deterministicResults, '');
      const deterministicStats = this.toolMatchStatsByTool(deterministicResults);
      const contentMatches = Number(deterministicStats.get('content.search_text') || 0);
      const pluginMatches = Number(deterministicStats.get('plugins.settings.search_text') || 0);
      const themeMatches = Number(deterministicStats.get('themes.config.search_text') || 0);
      const totalExactMatches = contentMatches + pluginMatches + themeMatches;
      let targetTextMatches = 0;
      let broadContentMatches = 0;
      let broadPluginMatches = 0;
      let broadThemeMatches = 0;

      if (!deterministicActions.length && totalExactMatches === 0) {
        const targetCalls: Array<{ tool: string; input: Record<string, any> }> = [
          { tool: 'content.search_text', input: { query: replaceInstruction.to, maxMatches: 80 } },
          { tool: 'plugins.settings.search_text', input: { query: replaceInstruction.to, maxMatches: 80 } },
          { tool: 'themes.config.search_text', input: { query: replaceInstruction.to, maxMatches: 80 } },
        ];
        const targetResults = await runSearchCalls(targetCalls);
        const targetStats = this.toolMatchStatsByTool(targetResults);
        targetTextMatches =
          Number(targetStats.get('content.search_text') || 0) +
          Number(targetStats.get('plugins.settings.search_text') || 0) +
          Number(targetStats.get('themes.config.search_text') || 0);

        if (!targetTextMatches) {
          const broadQuery = this.buildSharedReplaceSearchQuery(replaceInstruction.from, replaceInstruction.to);
          if (broadQuery) {
            const broadCalls: Array<{ tool: string; input: Record<string, any> }> = [
              { tool: 'content.search_text', input: { query: broadQuery, maxMatches: 80 } },
              { tool: 'plugins.settings.search_text', input: { query: broadQuery, maxMatches: 80 } },
              { tool: 'themes.config.search_text', input: { query: broadQuery, maxMatches: 80 } },
            ];
            const broadResults = await runSearchCalls(broadCalls);
            const broadStats = this.toolMatchStatsByTool(broadResults);
            broadContentMatches = Number(broadStats.get('content.search_text') || 0);
            broadPluginMatches = Number(broadStats.get('plugins.settings.search_text') || 0);
            broadThemeMatches = Number(broadStats.get('themes.config.search_text') || 0);
          }
        }
      }

      let deterministicMessage = deterministicSummary;
      if (deterministicActions.length) {
        deterministicMessage = [
          `I found ${totalExactMatches} exact match${totalExactMatches === 1 ? '' : 'es'} for "${replaceInstruction.from}" and staged ${deterministicActions.length} safe change${deterministicActions.length === 1 ? '' : 's'}.`,
          'Review the staged updates below.',
          'Then run Preview to confirm before/after, and apply when you are ready.',
        ].join('\n');
      } else if (targetTextMatches > 0) {
        deterministicMessage = [
          `I could not find exact matches for "${replaceInstruction.from}".`,
          `I did find ${targetTextMatches} match${targetTextMatches === 1 ? '' : 'es'} for "${replaceInstruction.to}", so this change may already be done.`,
          'If you want, I can run a broader similarity scan and stage likely candidates for your approval.',
        ].join('\n');
      } else if (totalExactMatches === 0 && (broadContentMatches + broadPluginMatches + broadThemeMatches) > 0) {
        deterministicMessage = [
          `I did not find exact matches for "${replaceInstruction.from}", but I found likely candidates.`,
          `Candidates: content ${broadContentMatches}, plugin settings ${broadPluginMatches}, theme config ${broadThemeMatches}.`,
          'I can stage these as explicit before/after candidates for approval.',
        ].join('\n');
      } else if (totalExactMatches === 0) {
        deterministicMessage = [
          `I searched content, plugin settings, and theme config for "${replaceInstruction.from}" and found no exact or near matches.`,
          'No safe actions were staged yet.',
          'If you share a page slug, collection name, or field path, I can run a targeted search and stage exact updates.',
        ].join('\n');
      }

      const deterministicText = this.sanitizeUserFacingMessage(
        this.normalizePlanModeMessage(
          deterministicMessage,
          'advanced',
          deterministicActions.length > 0,
          true,
        ),
        'advanced',
      );
      const deterministicTraces: AssistantChatTrace[] = [
        {
          iteration: 1,
          message: deterministicActions.length
            ? 'Ran exact text search and staged safe replacement actions.'
            : 'Ran exact text search across content, plugin settings, and theme config.',
          phase: 'planner',
          toolCalls: deterministicCalls,
        },
      ];
      const deterministicPlan = this.buildPlanArtifact({
        planId,
        goal: message,
        message: deterministicText,
        traces: deterministicTraces,
        actions: deterministicActions,
        loopCapReached: false,
        loopTimeLimitReached: false,
        done: true,
        selectedSkill,
      });
      return {
        message: deterministicText,
        actions: deterministicActions,
        model: '',
        agentMode: 'advanced',
        done: true,
        traces: deterministicTraces,
        plan: deterministicPlan,
        ui: this.buildUiHints({
          hasActions: deterministicActions.length > 0,
          loopCapReached: false,
          loopTimeLimitReached: false,
          done: true,
          selectedSkill,
        }),
        skill: selectedSkill,
        sessionId,
        iterations: 1,
        loopCapReached: false,
      };
    }

    const systemPrompt = [
      customAdvancedSystemPrompt || this.buildDefaultAdvancedSystemPrompt(),
      ...runtimeContextLines,
      ...normalizedExtensionPromptLines,
    ].join('\n');

    const loopHistory: AssistantMessage[] = [...normalizedHistory];
    const stagedActions: AssistantAction[] = [];
    const traces: AssistantChatTrace[] = [];
    let assistantMessage = 'No response generated.';
    let usedModel = '';
    let loopDone = false;
    let loopCapReached = false;
    let iterationsRan = 0;
    let loopTimeLimitReached = false;
    let currentPrompt = message;
    const inferredSearchQuery = this.inferSearchQueryFromPrompt(message);
    let lastExecutedToolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
    const allExecutedToolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];

    const loopStartedAt = Date.now();
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      if (Date.now() - loopStartedAt > maxDurationMs) {
        loopCapReached = true;
        loopTimeLimitReached = true;
        break;
      }
      iterationsRan = iteration + 1;
      const completion = await aiClient.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          ...loopHistory,
          { role: 'user', content: currentPrompt },
        ],
        json: true,
        temperature: 0.2,
        maxTokens: 1600,
      });

      usedModel = completion.model || usedModel;
      const extracted = this.extractJsonObject(completion.content);
      const parsed = extracted || {};
      const parsedMessage = String(parsed?.message || '').trim();

      const parsedActions = this.sanitizeActions(Array.isArray(parsed?.actions) ? parsed.actions : []);
      if (parsedActions.length) {
        stagedActions.push(...parsedActions);
      }

      const rawToolCalls = Array.isArray(parsed?.toolCalls)
        ? parsed.toolCalls
        : Array.isArray(parsed?.tools)
          ? parsed.tools
          : [];
      const toolCalls = rawToolCalls
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => ({
          tool: String(item.tool || item.name || '').trim(),
          input: item.input && typeof item.input === 'object' ? item.input : {},
        }))
        .filter((item: any) => !!item.tool);

      const allowRawFallback = agentMode !== 'advanced';
      const rawMessage = parsedMessage || (!extracted && allowRawFallback ? String(completion.content || '').trim() : '');
      if (rawMessage) {
        assistantMessage = rawMessage;
      } else if (parsedActions.length || toolCalls.length) {
        if (toolCalls.length && !parsedActions.length) {
          assistantMessage = 'Gathering context with tools before finalizing the plan.';
        } else if (parsedActions.length && !toolCalls.length) {
          assistantMessage = 'Staged actions are ready for preview and approval.';
        } else {
          assistantMessage = 'Collected context and staged candidate actions for approval.';
        }
      }

      traces.push({
        iteration: iteration + 1,
        message: rawMessage,
        phase: 'planner',
        toolCalls,
      });

      const done = parsed?.done === true;
      if (done) {
        loopDone = true;
      }
      if (agentMode === 'advanced' && !done && toolCalls.length === 0 && iteration < maxIterations - 1) {
        loopHistory.push({ role: 'assistant', content: rawMessage || `Iteration ${iteration + 1}` });
        while (loopHistory.length > 18) {
          loopHistory.shift();
        }
        currentPrompt = 'Return a FINAL response now. Summarize findings from prior tool results and stage any needed write actions. Set done=true.';
        continue;
      }

      const shouldContinueLoop = agentMode === 'advanced' && !done && toolCalls.length > 0;
      if (!shouldContinueLoop) {
        break;
      }

      const toolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
      const executedToolCalls: Array<{ tool: string; input: Record<string, any> }> = [];
      for (const call of toolCalls) {
        if (Date.now() - loopStartedAt > maxDurationMs) {
          loopCapReached = true;
          loopTimeLimitReached = true;
          break;
        }
        const callInput = call.input && typeof call.input === 'object' ? { ...call.input } : {};
        const isSearchTool = /(?:^|\.)(search_text)$/.test(String(call.tool || ''));
        if (isSearchTool) {
          const queryValue = String((callInput as any)?.query || (callInput as any)?.text || '').trim();
          if (!queryValue && inferredSearchQuery) {
            (callInput as any).query = inferredSearchQuery;
          }
        }

        if (!isToolAllowed(call.tool)) {
          toolResults.push({
            tool: call.tool,
            input: callInput,
            result: { ok: false, error: `Tool "${call.tool}" is not enabled for this run.` },
          });
          continue;
        }

        const result = await mcpBridge.call({
          tool: call.tool,
          input: callInput,
          context: { dryRun: true },
        });
        executedToolCalls.push({
          tool: call.tool,
          input: callInput,
        });
        toolResults.push({
          tool: call.tool,
          input: callInput,
          result,
        });
      }
      if (loopTimeLimitReached) {
        break;
      }
      lastExecutedToolResults = toolResults;
      allExecutedToolResults.push(...toolResults);
      traces.push({
        iteration: iteration + 1,
        phase: 'executor',
        message: `Executed ${toolResults.length} tool call${toolResults.length === 1 ? '' : 's'} in dry-run context.`,
        toolCalls: executedToolCalls,
      });

      const verifierErrorCount = toolResults.filter((item) => item?.result?.ok === false || item?.result?.error).length;
      const verifierMessage = verifierErrorCount
        ? `Verifier: ${verifierErrorCount} tool call${verifierErrorCount === 1 ? '' : 's'} returned errors. Refining next step.`
        : 'Verifier: tool outputs collected. Continuing with the next best step.';
      traces.push({
        iteration: iteration + 1,
        phase: 'verifier',
        message: verifierMessage,
        toolCalls: [],
      });

      loopHistory.push(
        { role: 'assistant', content: rawMessage || `Iteration ${iteration + 1}` },
        { role: 'system', content: `TOOL_RESULTS_JSON:${JSON.stringify(toolResults)}` },
      );
      while (loopHistory.length > 18) {
        loopHistory.shift();
      }
      currentPrompt = 'Continue with the next best step. Use tools if needed, then return final staged actions when done.';
    }
    if (!loopDone && iterationsRan >= maxIterations) {
      loopCapReached = true;
    }

    const dedupedActions = Array.from(
      new Map(stagedActions.map((action) => [JSON.stringify(action), action])).values()
    );
    let safeActions = await this.filterUnsafeStagedActions(dedupedActions, availableTools);
    const readOnlyDiscoveryIntent = this.isReadOnlyDiscoveryIntent(message);
    if (readOnlyDiscoveryIntent && safeActions.length) {
      safeActions = [];
      if (allExecutedToolResults.length > 0) {
        assistantMessage = this.buildToolResultsFallbackMessage(allExecutedToolResults, assistantMessage);
      }
    }
    if (readOnlyDiscoveryIntent) {
      const discoveryResults = [...allExecutedToolResults];
      const discoveryQuery = this.inferSearchQueryFromPrompt(message);
      const hasContentSearch = discoveryResults.some((item) => String(item?.tool || '') === 'content.search_text');
      if (!hasContentSearch && discoveryQuery) {
        const contentSearchResult = await mcpBridge.call({
          tool: 'content.search_text',
          input: { query: discoveryQuery, maxMatches: 80 },
          context: { dryRun: true },
        });
        discoveryResults.push({
          tool: 'content.search_text',
          input: { query: discoveryQuery, maxMatches: 80 },
          result: contentSearchResult,
        });
      }
      if (discoveryResults.length > 0) {
        assistantMessage = this.buildToolResultsFallbackMessage(discoveryResults, assistantMessage);
      }
    }
    if (!readOnlyDiscoveryIntent && !safeActions.length && allExecutedToolResults.length > 0) {
      const fallbackActions = await this.stageFallbackReplaceActions(message, allExecutedToolResults, mcpBridge);
      if (fallbackActions.length) {
        safeActions = await this.filterUnsafeStagedActions(fallbackActions, availableTools);
        if (safeActions.length) {
          assistantMessage = `Staged ${safeActions.length} replacement action${safeActions.length === 1 ? '' : 's'} from exact matches.`;
          loopDone = true;
        }
      }
    }
    const interimMessage = this.isInterimPlanningMessage(assistantMessage);
    if (!safeActions.length && allExecutedToolResults.length > 0) {
      const shouldOverride = this.shouldUseToolSummaryOverride(assistantMessage, allExecutedToolResults);
      if (shouldOverride || interimMessage) {
        assistantMessage = this.buildToolResultsFallbackMessage(allExecutedToolResults, assistantMessage);
      }
    } else if (!safeActions.length && lastExecutedToolResults.length > 0) {
      const looksInterim = interimMessage || /no response generated/i.test(String(assistantMessage || ''));
      if (looksInterim) {
        assistantMessage = this.buildToolResultsFallbackMessage(lastExecutedToolResults, assistantMessage);
      }
    }
    if (!safeActions.length && !readOnlyDiscoveryIntent && !replaceInstruction) {
      const current = String(assistantMessage || '').trim();
      if (!current || this.isInterimPlanningMessage(current) || /no safe executable plan|plan stopped before executable actions/i.test(current)) {
        assistantMessage =
          'I could not stage safe write actions yet. Give me one concrete target (collection + id/slug + field), and I will build a clear approval plan.';
      }
    }
    if (!safeActions.length && loopCapReached && !readOnlyDiscoveryIntent && !replaceInstruction) {
      assistantMessage =
        'I need one more pass to complete this plan safely. Continue?';
    }
    if (!safeActions.length && loopCapReached && this.containsPlaceholderTarget(assistantMessage)) {
      assistantMessage =
        'I could not stage a reliable plan yet. Please provide a concrete target (collection + record id/slug + field path + new value), then I will stage exact actions for preview.';
    }
    if (!safeActions.length) {
      const current = String(assistantMessage || '').trim();
      if (!current || this.isInterimPlanningMessage(current)) {
        assistantMessage = loopDone
          ? 'Plan finished with no executable actions. No changes were run.'
          : loopTimeLimitReached
            ? 'I need one more pass to complete this plan safely. Continue?'
            : loopCapReached
            ? 'I need one more pass to complete this plan safely. Continue?'
            : 'Plan did not finish staging executable actions. No changes were run.';
      }
    }
    if (selectedSkill?.riskPolicy === 'read_only' && safeActions.length > 0) {
      safeActions = [];
      assistantMessage =
        'Selected skill is read-only. I gathered context but did not stage write actions. Switch to a writable skill to stage changes.';
    }

    const normalizedPlanMessage = this.normalizePlanModeMessage(
      assistantMessage,
      agentMode === 'advanced' ? 'advanced' : 'basic',
      safeActions.length > 0,
      loopDone || safeActions.length > 0,
    );
    const userFacingMessage = this.sanitizeUserFacingMessage(
      normalizedPlanMessage,
      agentMode === 'advanced' ? 'advanced' : 'basic',
    );
    const done = loopDone || safeActions.length > 0;
    const plan = this.buildPlanArtifact({
      planId,
      goal: message,
      message: userFacingMessage,
      traces,
      actions: safeActions,
      loopCapReached,
      loopTimeLimitReached,
      done,
      selectedSkill,
    });
    const ui = this.buildUiHints({
      hasActions: safeActions.length > 0,
      loopCapReached,
      loopTimeLimitReached,
      done,
      selectedSkill,
    });
    const checkpoint: AssistantSessionCheckpoint | undefined =
      ui.canContinue
        ? {
            resumePrompt: 'Continue planning from previous context. Run more steps and stage executable actions if safe.',
            reason: loopTimeLimitReached ? 'time_cap' : 'loop_cap',
          }
        : undefined;

    return {
      message: userFacingMessage,
      actions: safeActions,
      model: usedModel,
      agentMode: agentMode === 'advanced' ? 'advanced' : 'basic',
      done,
      traces,
      plan,
      ui,
      skill: selectedSkill,
      sessionId,
      checkpoint,
      iterations: iterationsRan,
      loopCapReached,
    };
  }

  async executeActions(input: AssistantExecuteInput): Promise<AssistantExecuteResult> {
    const actions = this.sanitizeActions(Array.isArray(input?.actions) ? input.actions : []);
    const dryRun = input?.dryRun !== false;
    const context = input?.context || {};
    const mcpBridge = await this.buildMcpBridge(dryRun);

    if (!actions.length) {
      throw new Error('actions are required');
    }

    const results: any[] = [];

    for (const rawAction of actions) {
      const type = String(rawAction?.type || '').trim();
      if (!type) {
        results.push({ ok: false, error: 'Missing action type' });
        continue;
      }

      if (type === 'create_content') {
        const collectionSlug = String(rawAction?.collectionSlug || '').trim();
        const payload = rawAction?.data && typeof rawAction.data === 'object' ? rawAction.data : {};
        const collection = this.options.findCollectionBySlug(collectionSlug);
        if (!collection) {
          results.push({ ok: false, type, collectionSlug, error: `Unknown collection: ${collectionSlug}` });
          continue;
        }

        if (dryRun) {
          results.push({
            ok: true,
            dryRun: true,
            type,
            collectionSlug: collection.slug,
            preview: payload,
          });
          continue;
        }

        const created = await this.options.createContent(collection, payload, context);
        results.push({
          ok: true,
          type,
          collectionSlug: collection.slug,
          id: created?.id,
          item: created,
        });
        continue;
      }

      if (type === 'update_setting') {
        const key = String(rawAction?.key || '').trim();
        const value = String(rawAction?.value ?? '').trim();
        if (!key) {
          results.push({ ok: false, type, error: 'Missing setting key' });
          continue;
        }

        const existing = await this.options.getSetting(key);
        const keyValidationError = this.validateWritableSettingKey(key, existing);
        if (keyValidationError) {
          results.push({ ok: false, type, key, error: keyValidationError });
          continue;
        }

        if (dryRun) {
          results.push({ ok: true, dryRun: true, type, key, value });
          continue;
        }

        const group = String(existing?.group || 'ai-assistant').trim() || 'ai-assistant';
        await this.options.upsertSetting(key, value, group);
        results.push({ ok: true, type, key, value });
        continue;
      }

      if (type === 'mcp_call') {
        const tool = String(rawAction?.tool || '').trim();
        const callInput = rawAction?.input && typeof rawAction.input === 'object' ? rawAction.input : {};
        if (!tool) {
          results.push({ ok: false, type, error: 'Missing MCP tool name' });
          continue;
        }

        const callResult = await mcpBridge.call({
          tool,
          input: callInput,
          context: {
            ...context,
            dryRun,
          },
        });

        if (!callResult.ok) {
          results.push({ ok: false, type, tool, input: callInput, error: callResult.error || 'MCP call failed' });
          continue;
        }

        results.push({ ok: true, type, tool, input: callInput, dryRun, output: callResult.output });
        continue;
      }

      results.push({ ok: false, type, error: `Unsupported action type: ${type}` });
    }

    return {
      success: results.some((item) => item.ok),
      dryRun,
      results,
    };
  }
}
