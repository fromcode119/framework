import type { McpBridge } from '@fromcode119/mcp';
import type {
  AdminAssistantRuntimeOptions,
  AssistantAction,
  AssistantExecuteInput,
  AssistantExecuteResult,
  AssistantSettingValue,
} from '../admin-assistant-runtime/types';

export class AdminAssistantRuntimeActionExecutor {
  constructor(private readonly options: AdminAssistantRuntimeOptions) {}

  async executeActions(
    input: AssistantExecuteInput,
    createBridge: (dryRun: boolean) => Promise<McpBridge>,
  ): Promise<AssistantExecuteResult> {
    const actions = this.sanitizeActions(Array.isArray(input?.actions) ? input.actions : []);
    const dryRun = input?.dryRun !== false;
    const context = input?.context || {};
    const mcpBridge = await createBridge(dryRun);

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
        await this.executeCreateContent(rawAction, dryRun, context, results);
        continue;
      }
      if (type === 'update_setting') {
        await this.executeUpdateSetting(rawAction, dryRun, results);
        continue;
      }
      if (type === 'mcp_call') {
        await this.executeMcpCall(rawAction, dryRun, context, mcpBridge, results);
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

  private sanitizeActions(actions: any[]): AssistantAction[] {
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

  private async executeCreateContent(
    rawAction: AssistantAction,
    dryRun: boolean,
    context: Record<string, any>,
    results: any[],
  ): Promise<void> {
    const type = String(rawAction?.type || '').trim();
    const collectionSlug = String(rawAction?.collectionSlug || '').trim();
    const payload = rawAction?.data && typeof rawAction.data === 'object' ? rawAction.data : {};
    const collection = this.options.findCollectionBySlug(collectionSlug);
    if (!collection) {
      results.push({ ok: false, type, collectionSlug, error: `Unknown collection: ${collectionSlug}` });
      return;
    }
    if (dryRun) {
      results.push({ ok: true, dryRun: true, type, collectionSlug: collection.slug, preview: payload });
      return;
    }
    const created = await this.options.createContent(collection, payload, context);
    results.push({ ok: true, type, collectionSlug: collection.slug, id: created?.id, item: created });
  }

  private async executeUpdateSetting(
    rawAction: AssistantAction,
    dryRun: boolean,
    results: any[],
  ): Promise<void> {
    const type = String(rawAction?.type || '').trim();
    const key = String(rawAction?.key || '').trim();
    const value = String(rawAction?.value ?? '').trim();
    if (!key) {
      results.push({ ok: false, type, error: 'Missing setting key' });
      return;
    }

    const existing = await this.options.getSetting(key);
    const keyValidationError = this.validateWritableSettingKey(key, existing);
    if (keyValidationError) {
      results.push({ ok: false, type, key, error: keyValidationError });
      return;
    }
    if (dryRun) {
      results.push({ ok: true, dryRun: true, type, key, value });
      return;
    }

    const group = String(existing?.group || 'ai-assistant').trim() || 'ai-assistant';
    await this.options.upsertSetting(key, value, group);
    results.push({ ok: true, type, key, value });
  }

  private async executeMcpCall(
    rawAction: AssistantAction,
    dryRun: boolean,
    context: Record<string, any>,
    mcpBridge: McpBridge,
    results: any[],
  ): Promise<void> {
    const type = String(rawAction?.type || '').trim();
    const tool = String(rawAction?.tool || '').trim();
    const callInput = rawAction?.input && typeof rawAction.input === 'object' ? rawAction.input : {};
    if (!tool) {
      results.push({ ok: false, type, error: 'Missing MCP tool name' });
      return;
    }

    const callResult = await mcpBridge.call({
      tool,
      input: callInput,
      context: { ...context, dryRun },
    });
    if (!callResult.ok) {
      results.push({ ok: false, type, tool, input: callInput, error: callResult.error || 'MCP call failed' });
      return;
    }
    results.push({ ok: true, type, tool, input: callInput, dryRun, output: callResult.output });
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
    if (normalized.startsWith('assistant.') || normalized.startsWith('ai.') || normalized.startsWith('forge.')) {
      return null;
    }
    return `Unknown setting key "${normalized}". Use content records, plugin settings, or theme config updates for copy/config changes.`;
  }
}
