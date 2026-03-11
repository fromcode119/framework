import type { AssistantAction } from '../admin-assistant-core';

export class AssistantActionCardUtils {
  static summarize(action: AssistantAction): { title: string; detail: string } {
    if (action.type === 'mcp_call') {
      const tool = String(action.tool || 'action').trim();
      const input = action.input && typeof action.input === 'object' ? action.input : {};
      const filePath = String((input as any).path || '').trim();
      const collection = String((input as any).collectionSlug || '').trim();
      const slug = String((input as any).slug || '').trim();
      const idOrSlug = String((input as any).id ?? (input as any).recordId ?? (input as any).permalink ?? '').trim();

      if (tool === 'themes.files.replace_text' || tool === 'plugins.files.replace_text') {
        const target = slug || collection;
        return {
          title: tool,
          detail: filePath
            ? `File: ${filePath}${target ? ` • ${target}` : ''}`
            : target
              ? `Target: ${target}`
              : String(action.reason || 'Prepared file change').trim() || 'Prepared file change',
        };
      }

      if (tool === 'content.update') {
        return {
          title: tool,
          detail: collection
            ? `Record: ${collection}${idOrSlug ? ` #${idOrSlug}` : ''}`
            : String(action.reason || 'Prepared record update').trim() || 'Prepared record update',
        };
      }

      const target = String((input as any).collectionSlug || (input as any).slug || (input as any).id || '').trim();
      return {
        title: tool,
        detail: target ? `Target: ${target}` : String(action.reason || 'Prepared change').trim() || 'Prepared change',
      };
    }
    if (action.type === 'update_setting') {
      return {
        title: 'settings.set',
        detail: String(action.key || 'setting').trim() || 'setting',
      };
    }
    return {
      title: String(action.type || 'action').trim() || 'action',
      detail: String(action.reason || 'Prepared change').trim() || 'Prepared change',
    };
  }
}
