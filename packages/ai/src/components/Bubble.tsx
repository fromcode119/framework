import React from 'react';
import { AssistantMessage, AssistantAction } from '../types';
import { Shield, Zap } from 'lucide-react';

function actionStableKey(action: AssistantAction, index: number): string {
  const compact = {
    type: String(action?.type || ''),
    tool: String(action?.tool || ''),
    collectionSlug: String(action?.collectionSlug || ''),
    key: String(action?.key || ''),
    input: action?.input || null,
    data: action?.data || null,
    value: action?.value ?? null,
  };
  return `${index}:${JSON.stringify(compact)}`;
}

function describeAction(action: AssistantAction): string {
  if (!action || typeof action !== 'object') return 'action';
  if (action.type === 'mcp_call' && action.tool) {
    const collectionSlug = String(action.input?.collectionSlug || action.input?.slug || '').trim();
    if (collectionSlug) return `${action.tool} • ${collectionSlug}`;
    return String(action.tool);
  }
  if (action.type === 'create_content') {
    return `create_content • ${String(action.collectionSlug || 'collection')}`;
  }
  if (action.type === 'update_setting') {
    return `update_setting • ${String(action.key || 'setting')}`;
  }
  return String(action.type || 'action');
}

type ActionSurface = 'frontend' | 'backend' | 'mixed';

function normalizeSurfaceTool(tool: string): string {
  return String(tool || '').trim().toLowerCase();
}

function resolveToolSurface(toolName: string, input?: Record<string, any>): ActionSurface {
  const tool = normalizeSurfaceTool(toolName);
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

function resolveActionSurface(action: AssistantAction): ActionSurface {
  if (!action || typeof action !== 'object') return 'mixed';
  if (action.type === 'create_content') return 'frontend';
  if (action.type === 'update_setting') return 'backend';
  if (action.type === 'mcp_call') {
    return resolveToolSurface(String(action.tool || ''), action.input || {});
  }
  return 'mixed';
}

function surfaceLabel(surface: ActionSurface): string {
  if (surface === 'frontend') return 'Frontend';
  if (surface === 'backend') return 'Backend';
  return 'Mixed';
}

function surfaceBadgeClass(surface: ActionSurface): string {
  if (surface === 'frontend') {
    return 'border-cyan-300/80 bg-cyan-100/85 text-cyan-900 dark:border-cyan-300/45 dark:bg-cyan-300/16 dark:text-cyan-100';
  }
  if (surface === 'backend') {
    return 'border-fuchsia-300/80 bg-fuchsia-100/85 text-fuchsia-900 dark:border-fuchsia-300/45 dark:bg-fuchsia-300/16 dark:text-fuchsia-100';
  }
  return 'border-slate-300/90 bg-slate-100/90 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/65 dark:text-slate-200';
}

function resolveExecutionKind(item: any): 'ok' | 'skipped' | 'failed' {
  const errorText = String(item?.error || '').toLowerCase();
  const output = item?.output && typeof item.output === 'object' ? item.output : null;
  if (output?.skipped === true) return 'skipped';
  if (errorText.includes('no values to set')) return 'skipped';
  if (!item?.ok) return 'failed';
  const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
  if (changedFields.length === 0 && item?.tool === 'content.update') return 'skipped';
  return 'ok';
}

function formatExecutionTitle(item: any): string {
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

function formatExecutionDetail(item: any): string {
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

function actionPayloadForDisplay(action: AssistantAction): Record<string, any> | undefined {
  if (!action || typeof action !== 'object') return undefined;
  if (action.type === 'mcp_call') {
    return action.input && typeof action.input === 'object' ? action.input : undefined;
  }
  if (action.type === 'create_content') {
    return action.data && typeof action.data === 'object' ? action.data : undefined;
  }
  if (action.type === 'update_setting') {
    return {
      key: action.key || '',
      value: action.value || '',
    };
  }
  return undefined;
}

export function Bubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const traces = Array.isArray(message.traces) ? message.traces : [];
  const iterationCount = Number(message.iterations || 0) > 0 ? Number(message.iterations) : traces.length;
  const totalToolCalls = traces.reduce((sum, trace) => sum + (Array.isArray(trace?.toolCalls) ? trace.toolCalls.length : 0), 0);
  
  const className = isUser
    ? 'ml-auto border-amber-300/30 bg-amber-500/10 text-slate-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-slate-100 backdrop-blur-md'
    : isAssistant
      ? 'border-white/20 bg-white/40 text-slate-900 shadow-xl dark:border-white/10 dark:bg-white/5 dark:text-slate-100 backdrop-blur-xl'
      : 'border-cyan-300/30 bg-cyan-500/10 text-cyan-900 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100 backdrop-blur-md';

  return (
    <div className={`max-w-[85%] overflow-hidden rounded-2xl border px-4 py-3 text-[14px] leading-relaxed transition-all hover:shadow-lg ${className}`}>
        <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                {isUser ? 'You' : isAssistant ? 'Forge AI' : 'System'}
            </p>
            {(message.model || message.provider) && (
                <div className="flex gap-2">
                    {message.provider && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-500/10 opacity-50 uppercase">
                            {message.provider}
                        </span>
                    )}
                    {message.model && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-500/15 opacity-60">
                            {message.model}
                        </span>
                    )}
                </div>
            )}
        </div>
        <div className="space-y-3">
            {/* The content rendering logic would go here, traditionally splitMessageBlocks and colleagues */}
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        
        {/* Process Details, Staged Actions, Execution Results would go here... truncated for now to simplify size */}
    </div>
  );
}
