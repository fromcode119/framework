import { ExecutionKind } from '@ai/enums/assistant-execution-kind.enum';
import { ActionSurface } from '@ai/enums/action-surface.enum';

export class AssistantSurfaceUtils {
  static resolveToolSurface(toolName: string, input?: Record<string, any>): ActionSurface {
    const tool = String(toolName || '').trim().toLowerCase();
    if (!tool) return ActionSurface.MIXED;
    if (tool.startsWith('themes.')) return ActionSurface.FRONTEND;
    if (tool.startsWith('content.')) return ActionSurface.FRONTEND;
    if (tool === 'plugins.list' || tool === 'themes.list') return ActionSurface.FRONTEND;
    if (tool.startsWith('plugins.settings.')) return ActionSurface.BACKEND;
    if (tool.startsWith('settings.') || tool.startsWith('system.')) return ActionSurface.BACKEND;
    return ActionSurface.MIXED;
  }

  static resolveExecutionSurface(item: any): ActionSurface {
    if (item?.type === 'update_setting') return ActionSurface.BACKEND;
    const tool = item?.type === 'mcp_call' ? String(item?.tool || '') : String(item?.type || '');
    const input = item?.input && typeof item.input === 'object' ? item.input : {};
    return AssistantSurfaceUtils.resolveToolSurface(tool, input);
  }

  static resolveExecutionKind(item: any): ExecutionKind {
    const errorText = String(item?.error || '').toLowerCase();
    const output = item?.output && typeof item.output === 'object' ? item.output : null;
    if (output?.skipped === true) return ExecutionKind.SKIPPED;
    if (errorText.includes('no values to set')) return ExecutionKind.SKIPPED;
    if (!item?.ok) return ExecutionKind.FAILED;
    const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
    if (changedFields.length === 0 && item?.tool === 'content.update') return ExecutionKind.SKIPPED;
    return ExecutionKind.OK;
  }
}
