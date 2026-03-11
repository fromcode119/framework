import type { AssistantAction, HumanActionPreview } from './assistant-core-constants.types';
import { AssistantConstants } from './assistant-core-constants';
import { AssistantCoreUtils } from './assistant-core-utils';
import { AssistantSurfaceUtils } from './assistant-surface-utils';

const TOOL_DESCRIPTION_FALLBACKS = AssistantConstants.TOOL_DESCRIPTION_FALLBACKS;

export class AssistantFormatUtils {

  static formatActionLabel(action: AssistantAction): string {
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

  static summarizeActionForHumans(action: AssistantAction): HumanActionPreview {
  if (action.type === 'create_content') {
    const payload = action.data && typeof action.data === 'object' ? action.data : {};
    const { fields, previews } = AssistantCoreUtils.summarizeFieldPatch(payload);
    return {
      title: 'Create content',
      target: String(action.collectionSlug || '').trim() || 'selected collection',
      summary: fields.length
        ? `Will set ${fields.length} field${fields.length > 1 ? 's' : ''}: ${fields.slice(0, 4).join(', ')}.`
        : 'Will create a new record.',
      fieldPreviews: previews,
    };
  }

  if (action.type === 'update_setting') {
    const key = String(action.key || '').trim() || 'setting';
    const valuePreview = AssistantCoreUtils.describeActionValue(action.value);
    return {
      title: 'Update setting',
      target: key,
      summary: 'Will update this setting value.',
      fieldPreviews: [{ field: key, value: valuePreview }],
    };
  }

  if (action.type === 'mcp_call') {
    const tool = String(action.tool || '').trim();
    const input = action.input && typeof action.input === 'object' ? action.input : {};

    if (tool === 'content.update') {
      const patch = input?.data && typeof input.data === 'object' ? input.data : {};
      const { fields, previews } = AssistantCoreUtils.summarizeFieldPatch(patch);
      return {
        title: 'Update content',
        target: AssistantCoreUtils.resolveActionTarget(input),
        summary: fields.length
          ? `Will update ${fields.length} field${fields.length > 1 ? 's' : ''}: ${fields.slice(0, 4).join(', ')}.`
          : 'Will update this record.',
        fieldPreviews: previews,
      };
    }

    if (tool === 'plugins.settings.update' || tool === 'themes.config.update') {
      const patch =
        input?.data && typeof input.data === 'object'
          ? input.data
          : input?.config && typeof input.config === 'object'
            ? input.config
            : {};
      const { fields, previews } = AssistantCoreUtils.summarizeFieldPatch(patch);
      return {
        title: tool === 'plugins.settings.update' ? 'Update plugin settings' : 'Update theme settings',
        target: AssistantCoreUtils.resolveActionTarget(input),
        summary: fields.length
          ? `Will update ${fields.length} field${fields.length > 1 ? 's' : ''}: ${fields.slice(0, 4).join(', ')}.`
          : 'Will update configuration.',
        fieldPreviews: previews,
      };
    }

    return {
      title: AssistantFormatUtils.formatActionLabel(action),
      target: AssistantCoreUtils.resolveActionTarget(input),
      summary: 'Will run this action.',
      fieldPreviews: [],
    };
  }

  return {
    title: AssistantFormatUtils.formatActionLabel(action),
    target: 'selected target',
    summary: 'Will run this action.',
    fieldPreviews: [],
  };
  }

  static formatFileSize(size?: number): string {
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

  static sanitizeTraceToolCalls(input: any): Array<{ tool?: string; input?: Record<string, any> }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: any) => ({
      tool: item?.tool ? String(item.tool) : undefined,
      input: item?.input && typeof item.input === 'object' ? item.input : undefined,
    }))
    .filter((item: { tool?: string; input?: Record<string, any> }) => !!item.tool);
  }

  static getToolHelp(toolName: string, providedDescription?: string): string {
  const explicit = String(providedDescription || '').trim();
  if (explicit) return explicit;
  const key = String(toolName || '').trim();
  const fallbackMap = TOOL_DESCRIPTION_FALLBACKS as Record<string, string>;
  if (!key) return 'No description available.';
  if (fallbackMap[key]) return fallbackMap[key];
  if (key.startsWith('content.')) return 'Content operation tool.';
  if (key.startsWith('collections.')) return 'Collection discovery tool.';
  if (key.startsWith('plugins.')) return 'Plugin management tool.';
  if (key.startsWith('themes.')) return 'Theme management tool.';
  if (key.startsWith('settings.')) return 'Settings read/update tool.';
  if (key.startsWith('media.')) return 'Media library tool.';
  if (key.startsWith('system.')) return 'System utility tool.';
  return 'No description available.';
  }

  static formatExecutionTitle(item: any): string {
  const output = item?.output && typeof item.output === 'object' ? item.output : null;
  const input = item?.input && typeof item.input === 'object' ? item.input : {};
  const tool = item?.type === 'mcp_call' ? String(item?.tool || 'action') : String(item?.type || 'action');
  const collection = String(input?.collectionSlug || input?.slug || output?.target?.collectionSlug || '').trim();
  const selector = input?.id ?? input?.recordId ?? input?.slug ?? input?.permalink ?? output?.target?.id ?? null;
  const kind = AssistantSurfaceUtils.resolveExecutionKind(item);

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

  static formatExecutionDetail(item: any): string {
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
  if (changedFields.length === 0 && AssistantSurfaceUtils.resolveExecutionKind(item) === 'skipped') {
    return 'Already up to date.';
  }
  return '';
  }

  static formatPreviewValue(value: any): string {
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
}
