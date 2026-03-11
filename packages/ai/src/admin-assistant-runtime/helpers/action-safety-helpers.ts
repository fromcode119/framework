import type { AssistantAction, AdminAssistantRuntimeOptions, AssistantToolSummary, AssistantSettingValue, AssistantCollectionContext } from '../types';
import { PathObjectHelpers } from './path-object-helpers';
import { RuntimeMiscHelpers } from './runtime-misc-helpers';

/** Action safety/filtering helpers extracted from AdminAssistantRuntime. */
export class ActionSafetyHelpers {
  static validateWritableSettingKey(key: string, existing: AssistantSettingValue): string | null {
    const normalized = String(key || '').trim();
    if (!normalized) return 'Missing setting key';
    if (normalized.startsWith('_')) return `Setting key "${normalized}" is reserved/internal and cannot be updated via assistant.`;
    if (!/^[a-zA-Z0-9._:-]+$/.test(normalized)) return `Setting key "${normalized}" contains unsupported characters.`;
    if (existing?.found) return null;
    if (normalized.startsWith('assistant.') || normalized.startsWith('ai.') || normalized.startsWith('forge.')) return null;
    return `Unknown setting key "${normalized}". Use content records, plugin settings, or theme config updates for copy/config changes.`;
  }

  static hasSelectorValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return String(value).trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  }

  static hasUsableContentUpdateSelector(input: Record<string, any>): boolean {
    if (!input || typeof input !== 'object') return false;
    return ['id', 'recordId', 'slug', 'entrySlug', 'lookupSlug', 'slugValue', 'permalink', 'path', 'where']
      .some((k) => ActionSafetyHelpers.hasSelectorValue((input as any)[k]));
  }

  static hasWritablePayload(input: Record<string, any>): boolean {
    if (!input || typeof input !== 'object') return false;
    const payload = (input as any).data;
    return payload && typeof payload === 'object' && Object.keys(payload).length > 0;
  }

  static async filterUnsafeStagedActions(
    actions: AssistantAction[], availableTools: AssistantToolSummary[],
    options: Pick<AdminAssistantRuntimeOptions, 'findCollectionBySlug' | 'resolveContent' | 'getSetting'>,
  ): Promise<AssistantAction[]> {
    const toolMap = new Map(
      (availableTools || []).map((t) => [String(t?.tool || '').trim(), !!t?.readOnly] as const).filter(([t]) => Boolean(t)),
    );
    const filtered: AssistantAction[] = [];
    for (const action of actions) {
      if (!action || typeof action !== 'object') continue;
      if (action.type === 'create_content') {
        const collectionSlug = String(action.collectionSlug || '').trim();
        const payload = action.data && typeof action.data === 'object' ? action.data : null;
        if (!collectionSlug || !payload || Object.keys(payload).length === 0) continue;
        if (!options.findCollectionBySlug(collectionSlug)) continue;
        filtered.push(action); continue;
      }
      if (action.type === 'update_setting') {
        const key = String(action.key || '').trim();
        const existing = await options.getSetting(key);
        const err = ActionSafetyHelpers.validateWritableSettingKey(key, existing);
        if (err) continue;
        filtered.push(action); continue;
      }
      if (action.type === 'mcp_call') {
        const tool = String(action.tool || '').trim();
        const input = action.input && typeof action.input === 'object' ? action.input : {};
        if (!tool || !toolMap.has(tool) || toolMap.get(tool) === true) continue;
        if (tool === 'content.update') {
          if (!ActionSafetyHelpers.hasUsableContentUpdateSelector(input) || !ActionSafetyHelpers.hasWritablePayload(input)) continue;
          const collectionSource = String((input as any)?.collectionSlug || (input as any)?.slug || '').trim();
          const collection = options.findCollectionBySlug(collectionSource);
          if (!collection) continue;
          if (typeof options.resolveContent === 'function') {
            const selector = {
              id: (input as any)?.id ?? (input as any)?.recordId,
              slug: (input as any)?.entrySlug ? String((input as any).entrySlug) : (input as any)?.lookupSlug ? String((input as any).lookupSlug) : (input as any)?.slugValue ? String((input as any).slugValue) : (input as any)?.slug ? String((input as any).slug) : undefined,
              permalink: (input as any)?.permalink ? String((input as any).permalink) : (input as any)?.path ? String((input as any).path) : undefined,
              where: (input as any)?.where && typeof (input as any).where === 'object' ? (input as any).where : undefined,
            };
            const existing = await options.resolveContent(collection, selector, { dryRun: true }).catch(() => null);
            if (!existing || typeof existing !== 'object') continue;
            const primaryKey = String((collection as any)?.raw?.primaryKey || 'id');
            const resolvedId = (existing as any)?.[primaryKey] ?? (existing as any)?.id;
            if (resolvedId === undefined || resolvedId === null || String(resolvedId).trim() === '') continue;
            if (RuntimeMiscHelpers.isInternalAssistantSessionTarget(collection.slug, resolvedId)) continue;
            const payloadRaw = (input as any)?.data && typeof (input as any).data === 'object' ? (input as any).data : {};
            const payload = PathObjectHelpers.filterContentPayloadByCollectionFields(collection, PathObjectHelpers.normalizePathKeyedObject(payloadRaw));
            if (!payload || Object.keys(payload).length === 0) continue;
            filtered.push({ ...action, tool, input: { collectionSlug: collection.slug, id: resolvedId, data: payload } }); continue;
          }
        }
        if (tool === 'content.create') {
          const collectionSource = String((input as any)?.collectionSlug || (input as any)?.slug || '').trim();
          const collection = options.findCollectionBySlug(collectionSource);
          if (!collection) continue;
          const payloadRaw = (input as any)?.data && typeof (input as any).data === 'object' ? (input as any).data : {};
          const payload = PathObjectHelpers.filterContentPayloadByCollectionFields(collection, PathObjectHelpers.normalizePathKeyedObject(payloadRaw));
          const primaryKey = String((collection as any)?.raw?.primaryKey || 'id').trim();
          if (primaryKey && Object.prototype.hasOwnProperty.call(payload, primaryKey)) delete (payload as any)[primaryKey];
          if (!payload || Object.keys(payload).length === 0) continue;
          filtered.push({ ...action, tool, input: { collectionSlug: collection.slug, data: payload } }); continue;
        }
        if (tool === 'settings.set') {
          const key = String((input as any)?.key || '').trim();
          const existing = await options.getSetting(key);
          if (ActionSafetyHelpers.validateWritableSettingKey(key, existing)) continue;
        }
        if (tool === 'plugins.files.replace_text' || tool === 'themes.files.replace_text') {
          const slug = String((input as any)?.slug || '').trim();
          const filePath = String((input as any)?.path || (input as any)?.filePath || '').trim();
          const from = String((input as any)?.from || (input as any)?.query || (input as any)?.search || '').trim();
          const to = String((input as any)?.to || (input as any)?.replaceWith || (input as any)?.value || '').trim();
          if (!slug || !filePath || !from || !to) continue;
          filtered.push({ ...action, tool, input: { slug, path: filePath, from, to } }); continue;
        }
        if (tool === 'plugins.settings.update') {
          const pluginSlug = String((input as any)?.slug || '').trim();
          let patch = (input as any)?.config && typeof (input as any).config === 'object' ? PathObjectHelpers.deepClone((input as any).config)
            : (input as any)?.data && typeof (input as any).data === 'object' ? PathObjectHelpers.deepClone((input as any).data) : {};
          if ((!patch || Object.keys(patch).length === 0) && String((input as any)?.key || '').trim() && (input as any)?.value !== undefined) {
            patch = {};
            const segments = PathObjectHelpers.normalizeConfigPathSegments(String((input as any).key));
            if (segments.length) PathObjectHelpers.setBySegments(patch, segments, (input as any).value);
          }
          if (!pluginSlug || !patch || typeof patch !== 'object' || Object.keys(patch).length === 0) continue;
          filtered.push({ ...action, tool, input: { slug: pluginSlug, merge: (input as any)?.merge !== false, data: patch } }); continue;
        }
        if (tool === 'themes.config.update') {
          const themeSlug = String((input as any)?.slug || '').trim();
          let patch = (input as any)?.config && typeof (input as any).config === 'object' ? PathObjectHelpers.deepClone((input as any).config)
            : (input as any)?.data && typeof (input as any).data === 'object' ? PathObjectHelpers.deepClone((input as any).data) : {};
          if ((!patch || Object.keys(patch).length === 0) && String((input as any)?.key || '').trim() && (input as any)?.value !== undefined) {
            patch = {};
            const segments = PathObjectHelpers.normalizeConfigPathSegments(String((input as any).key));
            if (segments.length) PathObjectHelpers.setBySegments(patch, segments, (input as any).value);
          }
          if (!themeSlug || !patch || typeof patch !== 'object' || Object.keys(patch).length === 0) continue;
          filtered.push({ ...action, tool, input: { slug: themeSlug, merge: (input as any)?.merge !== false, data: patch } }); continue;
        }
        filtered.push(action); continue;
      }
    }
    return filtered;
  }
}
