import { CoreServices } from '@fromcode119/core';
import type { ActionSurface } from './assistant-core-constants.types';

export class AssistantSurfaceUtils {

  static resolveToolSurface(toolName: string, input?: Record<string, any>): ActionSurface {
  const tool = String(toolName || '').trim().toLowerCase();
  const collection = String(input?.collectionSlug || input?.slug || '').toLowerCase();
  const pluginSlug = CoreServices.getInstance().collectionIdentity.extractPluginSlug(collection);
  if (!tool) return 'mixed';
  if (tool.startsWith('themes.')) return 'frontend';
  if (tool.startsWith('content.')) return 'frontend';
  if (tool === 'plugins.list' || tool === 'themes.list') return 'frontend';
  if (tool.startsWith('plugins.settings.')) return 'backend';
  if (tool.startsWith('settings.') || tool.startsWith('system.')) return 'backend';
  if (pluginSlug === 'cms') return 'frontend';
  return 'mixed';
  }

  static resolveExecutionSurface(item: any): ActionSurface {
  if (item?.type === 'update_setting') return 'backend';
  const tool = item?.type === 'mcp_call' ? String(item?.tool || '') : String(item?.type || '');
  const input = item?.input && typeof item.input === 'object' ? item.input : {};
  return AssistantSurfaceUtils.resolveToolSurface(tool, input);
  }

  static surfaceLabel(surface: ActionSurface): string {
  if (surface === 'frontend') return 'Frontend';
  if (surface === 'backend') return 'Backend';
  return 'Mixed';
  }

  static surfaceBadgeClass(surface: ActionSurface): string {
  if (surface === 'frontend') {
    return 'border-slate-300/90 bg-slate-100/90 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/65 dark:text-slate-200';
  }
  if (surface === 'backend') {
    return 'border-slate-400/90 bg-slate-200/90 text-slate-800 dark:border-slate-500/70 dark:bg-slate-700/70 dark:text-slate-100';
  }
  return 'border-slate-300/90 bg-slate-100/90 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/65 dark:text-slate-200';
  }

  static resolveExecutionKind(item: any): 'ok' | 'skipped' | 'failed' {
  const errorText = String(item?.error || '').toLowerCase();
  const output = item?.output && typeof item.output === 'object' ? item.output : null;
  if (output?.skipped === true) return 'skipped';
  if (errorText.includes('no values to set')) return 'skipped';
  if (!item?.ok) return 'failed';
  const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
  if (changedFields.length === 0 && item?.tool === 'content.update') return 'skipped';
  return 'ok';
  }
}
