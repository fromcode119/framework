'use client';

import React from 'react';

export const SURFACE_NAME = 'Forge';
export const AI_INTEGRATION_ENDPOINT = '/system/admin/integrations/ai';
export const AI_CHAT_ENDPOINT = '/forge/admin/assistant/chat';
export const AI_MODELS_ENDPOINT = '/forge/admin/assistant/models';
export const AI_TOOLS_ENDPOINT = '/forge/admin/assistant/tools';
export const AI_EXECUTE_ENDPOINT = '/forge/admin/assistant/actions/execute';
export const MAX_PROMPT_LENGTH = 2800;
export const FORGE_HISTORY_STORAGE_KEY = 'fromcode.forge.history.v1';
export const FORGE_ACTIVE_SESSION_KEY = 'fromcode.forge.active-session.v1';
export const FORGE_UI_PREFS_STORAGE_KEY = 'fromcode.forge.ui-prefs.v1';

export const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama' },
];

export const TOOL_DESCRIPTION_FALLBACKS: Record<string, string> = {
  'collections.list': 'List all available collections.',
  'collections.resolve': 'Find a collection by slug or alias.',
  'content.list': 'List content records from a collection.',
  'content.resolve': 'Get one content record by id/slug/permalink.',
  'content.search_text': 'Search text across content records and fields.',
  'content.create': 'Create a content record.',
  'content.update': 'Update a content record.',
  'content.delete': 'Delete a content record.',
  'settings.get': 'Read a system/plugin setting by key.',
  'settings.set': 'Update a system/plugin setting by key.',
  'plugins.list': 'List installed plugins.',
  'plugins.settings.get': 'Read plugin settings.',
  'plugins.settings.update': 'Update plugin settings.',
  'themes.list': 'List installed themes.',
  'themes.active': 'Get active theme.',
  'themes.config.get': 'Read theme config values.',
  'themes.config.search_text': 'Search text in theme configuration.',
  'themes.config.update': 'Update theme configuration.',
  'media.list': 'List media assets.',
  'media.search_text': 'Search text in media metadata.',
  'media.upload': 'Upload a new media asset.',
  'system.now': 'Return current server time.',
  'system.health': 'Check system health status.',
};

export type AssistantAction = {
  type: string;
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
};

export type AssistantPersona = {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
};

export type AssistantProvider = {
  id: string;
  name: string;
  models: Array<{ id: string; name: string }>;
};

export type AssistantMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: UploadedAttachment[];
  actions?: AssistantAction[];
  traces?: AssistantTrace[];
  done?: boolean;
  iterations?: number;
  loopCapReached?: boolean;
  model?: string;
  provider?: string;
  execution?: any;
  timestamp?: string;
};

export type AssistantToolOption = {
  tool: string;
  description?: string;
  readOnly?: boolean;
};

export type AssistantTrace = {
  iteration: number;
  message?: string;
  toolCalls?: Array<{ tool?: string; input?: Record<string, any> }>;
};

export type UploadedAttachment = {
  id?: string;
  name: string;
  url?: string;
  path?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};

export type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language: string };

export type ForgeHistorySession = {
  id: string;
  title: string;
  updatedAt: number;
  provider: string;
  model: string;
  chatMode: 'auto' | 'plan' | 'agent';
  sandboxMode: boolean;
  messages: AssistantMessage[];
};

export function splitMessageBlocks(content: string): MessageBlock[] {
  const source = String(content || '');
  if (!source.trim()) return [{ type: 'text', content: source }];

  const blocks: MessageBlock[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const start = match.index;
    const end = regex.lastIndex;
    if (start > cursor) {
      blocks.push({ type: 'text', content: source.slice(cursor, start) });
    }
    blocks.push({
      type: 'code',
      language: String(match[1] || '').trim(),
      content: String(match[2] || '').replace(/\n$/, ''),
    });
    cursor = end;
  }

  if (cursor < source.length) {
    blocks.push({ type: 'text', content: source.slice(cursor) });
  }
  return blocks;
}

export function renderInlineFormat(text: string, keyPrefix: string): React.ReactNode[] {
  const source = String(text || '');
  if (!source) return [''];

  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*.+?\*\*|"[^"\n]+"|'[^'\n]+')/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const start = match.index;
    const token = match[0];
    if (start > cursor) nodes.push(source.slice(cursor, start));

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${start}`}
          className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${start}`} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      nodes.push(
        <span
          key={`${keyPrefix}-quote-${start}`}
          className="inline-flex items-center rounded-md border border-indigo-300/55 bg-indigo-100/70 px-1.5 py-0.5 text-[11px] font-medium text-indigo-900 dark:border-indigo-300/35 dark:bg-indigo-300/16 dark:text-indigo-100"
        >
          {token}
        </span>,
      );
    } else {
      nodes.push(token);
    }
    cursor = start + token.length;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

export function formatActionLabel(action: AssistantAction): string {
  if (action.type === 'create_content') {
    return `create_content ${action.collectionSlug ? `• ${action.collectionSlug}` : ''}`;
  }
  if (action.type === 'update_setting') {
    return `update_setting ${action.key ? `• ${action.key}` : ''}`;
  }
  if (action.type === 'mcp_call') {
    const tool = String(action.tool || '').trim();
    const input = action.input && typeof action.input === 'object' ? action.input : {};
    const target =
      String((input as any)?.collectionSlug || (input as any)?.slug || (input as any)?.key || '').trim() ||
      String((input as any)?.id ?? '').trim();
    if (tool && target) return `${tool} • ${target}`;
    if (tool) return tool;
    return 'mcp_call';
  }
  return action.type || action.tool || 'action';
}

export function formatFileSize(size?: number): string {
  if (!Number.isFinite(size as number) || !size || size <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${units[unitIndex]}`;
}

export function sanitizeTraceToolCalls(input: any): Array<{ tool?: string; input?: Record<string, any> }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: any) => ({
      tool: item?.tool ? String(item.tool) : undefined,
      input: item?.input && typeof item.input === 'object' ? item.input : undefined,
    }))
    .filter((item: { tool?: string; input?: Record<string, any> }) => !!item.tool);
}

export function getToolHelp(toolName: string, providedDescription?: string): string {
  const explicit = String(providedDescription || '').trim();
  if (explicit) return explicit;
  const key = String(toolName || '').trim();
  if (!key) return 'No description available.';
  if (TOOL_DESCRIPTION_FALLBACKS[key]) return TOOL_DESCRIPTION_FALLBACKS[key];
  if (key.startsWith('content.')) return 'Content operation tool.';
  if (key.startsWith('collections.')) return 'Collection discovery tool.';
  if (key.startsWith('plugins.')) return 'Plugin management tool.';
  if (key.startsWith('themes.')) return 'Theme management tool.';
  if (key.startsWith('settings.')) return 'Settings read/update tool.';
  if (key.startsWith('media.')) return 'Media library tool.';
  if (key.startsWith('system.')) return 'System utility tool.';
  return 'No description available.';
}

export function serializeAttachmentsForModel(attachments: UploadedAttachment[]): string {
  if (!attachments.length) return '';
  const lines = attachments.map((item, index) => {
    const parts = [
      `name=${item.name}`,
      item.url ? `url=${item.url}` : '',
      item.path ? `path=${item.path}` : '',
      item.mimeType ? `mime=${item.mimeType}` : '',
      item.size ? `size=${item.size}` : '',
      item.width && item.height ? `dimensions=${item.width}x${item.height}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${parts.join('; ')}`;
  });
  return `Attached assets (uploaded by user):\n${lines.join('\n')}`;
}

export function stripReadyMessage(entries: AssistantMessage[]): AssistantMessage[] {
  return entries.filter((entry, index) => {
    if (
      index === 0 &&
      entry.role === 'system' &&
      String(entry.content || '').toLowerCase().includes('ready')
    ) {
      return false;
    }
    return true;
  });
}

export function summarizeSessionTitle(entries: AssistantMessage[]): string {
  const firstUser = entries.find((entry) => entry.role === 'user' && String(entry.content || '').trim());
  if (!firstUser) return 'Untitled session';
  const text = String(firstUser.content || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Untitled session';
  return text.length > 64 ? `${text.slice(0, 63)}...` : text;
}

export function isApprovalPrompt(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;
  return /^(yes|ok|okay|approve|apply|run|do it|go ahead|confirm|proceed)\b/.test(normalized);
}

export function hasPlanningIntent(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  if (!normalized.trim()) return false;
  return /(replace|change|update|create|delete|remove|fix|set|install|uninstall|rename|modify|stage|apply|plan|migrate|edit)\b/.test(normalized);
}

export function hasMutationIntent(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  if (!normalized.trim()) return false;
  if (/^(what|which|who|where|when|why|how)\b/.test(normalized)) return false;
  return /(replace|change|update|create|delete|remove|fix|set|install|uninstall|rename|modify|migrate|edit)\b/.test(normalized);
}

export function isPlanGuidanceMessage(entry: AssistantMessage): boolean {
  if (entry.role !== 'assistant') return false;
  if (Array.isArray(entry.actions) && entry.actions.length > 0) return false;
  const text = String(entry.content || '').toLowerCase();
  if (!text) return false;
  if (/reply[\s*`"']+yes/.test(text)) return false;
  if (/i switched to plan mode/.test(text)) return false;
  if (/no safe updates were staged/.test(text)) return false;
  return (
    /plan mode|switch to plan|stage(?:d)? actions|review staged|approve/.test(text) &&
    !/staged actions \(\d+\)/.test(text)
  );
}

export function isRunnablePlanPrompt(entry: AssistantMessage): boolean {
  if (entry.role !== 'assistant') return false;
  if (Array.isArray(entry.actions) && entry.actions.length > 0) return false;
  const text = String(entry.content || '').toLowerCase();
  if (!text) return false;
  return (
    /^plan\b/m.test(text) ||
    text.includes("here's the plan i've got") ||
    text.includes("here's the plan i can run next") ||
    text.includes('run this plan now') ||
    text.includes('reply "yes"')
  );
}

export function summarizeActions(actions: AssistantAction[]): string {
  if (!Array.isArray(actions) || actions.length === 0) return 'No staged changes.';

  let contentChanges = 0;
  let settingChanges = 0;
  let creates = 0;
  let other = 0;
  const collections = new Set<string>();

  actions.forEach((action) => {
    const type = String(action?.type || '').trim();
    if (type === 'create_content') {
      creates += 1;
      if (action.collectionSlug) collections.add(String(action.collectionSlug));
      return;
    }
    if (type === 'update_setting') {
      settingChanges += 1;
      return;
    }
    if (type === 'mcp_call') {
      const tool = String(action?.tool || '').trim().toLowerCase();
      const input = action?.input && typeof action.input === 'object' ? action.input : {};
      const collection = String((input as any)?.collectionSlug || (input as any)?.slug || '').trim();
      if (collection) collections.add(collection);
      if (tool.startsWith('content.')) {
        contentChanges += 1;
        return;
      }
      if (tool === 'plugins.settings.update' || tool === 'themes.config.update' || tool.startsWith('settings.')) {
        settingChanges += 1;
        return;
      }
      other += 1;
      return;
    }
    other += 1;
  });

  const parts: string[] = [];
  if (contentChanges > 0) parts.push(`${contentChanges} content ${contentChanges === 1 ? 'change' : 'changes'}`);
  if (creates > 0) parts.push(`${creates} new ${creates === 1 ? 'item' : 'items'}`);
  if (settingChanges > 0) parts.push(`${settingChanges} setting ${settingChanges === 1 ? 'update' : 'updates'}`);
  if (other > 0 || parts.length === 0) parts.push(`${other || actions.length} additional ${other === 1 ? 'step' : 'steps'}`);

  const collectionList = Array.from(collections);
  const scope =
    collectionList.length > 0
      ? ` in ${collectionList.slice(0, 2).join(', ')}${collectionList.length > 2 ? ' + more' : ''}`
      : '';

  return `I staged ${parts.join(', ')}${scope}.`;
}

export type ActionSurface = 'frontend' | 'backend' | 'mixed';

export function resolveToolSurface(toolName: string, input?: Record<string, any>): ActionSurface {
  const tool = String(toolName || '').trim().toLowerCase();
  const collection = String(input?.collectionSlug || input?.slug || '').toLowerCase();
  if (!tool) return 'mixed';
  if (tool.startsWith('themes.')) return 'frontend';
  if (tool.startsWith('content.')) return 'frontend';
  if (tool === 'plugins.list' || tool === 'themes.list') return 'frontend';
  if (tool.startsWith('plugins.settings.')) return 'backend';
  if (tool.startsWith('settings.') || tool.startsWith('system.')) return 'backend';
  if (collection.startsWith('fcp_cms_')) return 'frontend';
  return 'mixed';
}

export function resolveExecutionSurface(item: any): ActionSurface {
  if (item?.type === 'update_setting') return 'backend';
  const tool = item?.type === 'mcp_call' ? String(item?.tool || '') : String(item?.type || '');
  const input = item?.input && typeof item.input === 'object' ? item.input : {};
  return resolveToolSurface(tool, input);
}

export function surfaceLabel(surface: ActionSurface): string {
  if (surface === 'frontend') return 'Frontend';
  if (surface === 'backend') return 'Backend';
  return 'Mixed';
}

export function surfaceBadgeClass(surface: ActionSurface): string {
  if (surface === 'frontend') {
    return 'border-cyan-300/80 bg-cyan-100/85 text-cyan-900 dark:border-cyan-300/45 dark:bg-cyan-300/16 dark:text-cyan-100';
  }
  if (surface === 'backend') {
    return 'border-fuchsia-300/80 bg-fuchsia-100/85 text-fuchsia-900 dark:border-fuchsia-300/45 dark:bg-fuchsia-300/16 dark:text-fuchsia-100';
  }
  return 'border-slate-300/90 bg-slate-100/90 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/65 dark:text-slate-200';
}

export function resolveExecutionKind(item: any): 'ok' | 'skipped' | 'failed' {
  const errorText = String(item?.error || '').toLowerCase();
  const output = item?.output && typeof item.output === 'object' ? item.output : null;
  if (output?.skipped === true) return 'skipped';
  if (errorText.includes('no values to set')) return 'skipped';
  if (!item?.ok) return 'failed';
  const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
  if (changedFields.length === 0 && item?.tool === 'content.update') return 'skipped';
  return 'ok';
}

export function formatExecutionTitle(item: any): string {
  const output = item?.output && typeof item.output === 'object' ? item.output : null;
  const input = item?.input && typeof item.input === 'object' ? item.input : {};
  const tool = item?.type === 'mcp_call' ? String(item?.tool || 'action') : String(item?.type || 'action');
  const collection = String(input?.collectionSlug || input?.slug || output?.target?.collectionSlug || '').trim();
  const selector = input?.id ?? input?.recordId ?? input?.slug ?? input?.permalink ?? output?.target?.id ?? null;
  const kind = resolveExecutionKind(item);

  if (tool === 'content.update') {
    if (kind === 'failed') return `Could not update ${collection || 'record'}`;
    if (kind === 'skipped') return `No change needed for ${collection || 'record'}`;
    return `Updated ${collection || 'record'}`;
  }
  if (tool === 'themes.config.update') {
    return kind === 'failed' ? 'Could not update theme setting' : kind === 'skipped' ? 'No theme changes needed' : 'Updated theme setting';
  }
  if (tool === 'plugins.settings.update') {
    return kind === 'failed' ? 'Could not update plugin setting' : kind === 'skipped' ? 'No plugin changes needed' : 'Updated plugin setting';
  }
  if (selector !== null && selector !== undefined && String(selector).trim()) {
    return `${tool} • ${String(selector)}`;
  }
  return tool;
}

export function formatExecutionDetail(item: any): string {
  const errorText = String(item?.error || '').trim();
  if (errorText) {
    if (/record not found/i.test(errorText)) {
      return 'Could not find that record. It may have been deleted or selected with the wrong ID.';
    }
    if (/no values to set/i.test(errorText)) {
      return 'Nothing changed because this record already has the target value.';
    }
    return errorText;
  }
  const output = item?.output && typeof item.output === 'object' ? item.output : null;
  if (output?.reason) return String(output.reason);
  const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
  if (changedFields.length === 0 && resolveExecutionKind(item) === 'skipped') {
    return 'Already up to date.';
  }
  return '';
}

export function normalizePreviewPath(value: any): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  return `/${raw.replace(/^\/+/, '')}`;
}

export function pickPreviewPathFromRecord(record: any): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  const keys = ['customPermalink', 'permalink', 'path', 'url', 'slug'];
  for (const key of keys) {
    const path = normalizePreviewPath((record as any)?.[key]);
    if (path) return path;
  }
  return undefined;
}

export function toAbsolutePreviewUrl(path?: string): string | undefined {
  const normalized = normalizePreviewPath(path);
  if (!normalized) return undefined;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (typeof window === 'undefined') return normalized;
  return `${window.location.origin}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

export function resolveExecutionPreviewPaths(item: any): { beforePath?: string; afterPath?: string; currentPath?: string } {
  const output = item?.output && typeof item.output === 'object' ? item.output : {};
  const input = item?.input && typeof item.input === 'object' ? item.input : {};
  const visual = output?.visualPreview && typeof output.visualPreview === 'object' ? output.visualPreview : {};

  const fromInput =
    normalizePreviewPath(input?.permalink) ||
    normalizePreviewPath(input?.path) ||
    normalizePreviewPath(input?.url) ||
    normalizePreviewPath(input?.slug);

  const beforePath =
    normalizePreviewPath(visual?.beforePath) ||
    pickPreviewPathFromRecord(output?.before) ||
    fromInput;

  const afterPath =
    normalizePreviewPath(visual?.afterPath) ||
    normalizePreviewPath(visual?.path) ||
    pickPreviewPathFromRecord(output?.item) ||
    pickPreviewPathFromRecord(output?.after) ||
    fromInput;

  const currentPath = afterPath || beforePath || fromInput;
  return {
    beforePath: beforePath || undefined,
    afterPath: afterPath || undefined,
    currentPath: currentPath || undefined,
  };
}

export function formatPreviewValue(value: any): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
