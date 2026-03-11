import type {
  AdminAssistantRuntimeOptions,
  AssistantAction,
  AssistantChatInput,
  AssistantChatResult,
  AssistantExecuteInput,
  AssistantExecuteResult,
  AssistantSkillDefinition,
  AssistantToolSummary,
} from './admin-assistant-runtime/types';

import { McpBridgeBuilder } from './admin-assistant-runtime/helpers/mcp-bridge-builder';
import { ChatRunner } from './admin-assistant-runtime/helpers/chat-runner';
import { RuntimeMiscHelpers } from './admin-assistant-runtime/helpers/runtime-misc-helpers';
import { ActionSafetyHelpers } from './admin-assistant-runtime/helpers/action-safety-helpers';

export class AdminAssistantRuntime {
  constructor(private readonly options: AdminAssistantRuntimeOptions) {}

  async listSkills(): Promise<AssistantSkillDefinition[]> {
    const defaults = RuntimeMiscHelpers.defaultSkillCatalog();
    const extra = await Promise.resolve(this.options.resolveSkills?.() || []);
    return RuntimeMiscHelpers.normalizeSkills([...(Array.isArray(extra) ? extra : []), ...defaults]);
  }

  async listTools(dryRun: boolean = true): Promise<AssistantToolSummary[]> {
    const bridge = await McpBridgeBuilder.build(this.options, dryRun);
    return bridge.listTools();
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

  async chat(input: AssistantChatInput): Promise<AssistantChatResult> {
    return ChatRunner.run(input, this.options);
  }

  async executeActions(input: AssistantExecuteInput): Promise<AssistantExecuteResult> {
    const actions = this.sanitizeActions(Array.isArray(input?.actions) ? input.actions : []);
    const dryRun = input?.dryRun !== false;
    const context = input?.context || {};
    const mcpBridge = await McpBridgeBuilder.build(this.options, dryRun);

    if (!actions.length) throw new Error('actions are required');

    const results: any[] = [];
    for (const rawAction of actions) {
      const type = String(rawAction?.type || '').trim();
      if (!type) { results.push({ ok: false, error: 'Missing action type' }); continue; }

      if (type === 'create_content') {
        const collectionSlug = String(rawAction?.collectionSlug || '').trim();
        const payload = rawAction?.data && typeof rawAction.data === 'object' ? rawAction.data : {};
        const collection = this.options.findCollectionBySlug(collectionSlug);
        if (!collection) { results.push({ ok: false, type, collectionSlug, error: `Unknown collection: ${collectionSlug}` }); continue; }
        if (dryRun) { results.push({ ok: true, dryRun: true, type, collectionSlug: collection.slug, preview: payload }); continue; }
        const created = await this.options.createContent(collection, payload, context);
        results.push({ ok: true, type, collectionSlug: collection.slug, id: created?.id, item: created });
        continue;
      }

      if (type === 'update_setting') {
        const key = String(rawAction?.key || '').trim();
        const value = String(rawAction?.value ?? '').trim();
        if (!key) { results.push({ ok: false, type, error: 'Missing setting key' }); continue; }
        const existing = await this.options.getSetting(key);
        const keyValidationError = ActionSafetyHelpers.validateWritableSettingKey(key, existing);
        if (keyValidationError) { results.push({ ok: false, type, key, error: keyValidationError }); continue; }
        if (dryRun) { results.push({ ok: true, dryRun: true, type, key, value }); continue; }
        const group = String(existing?.group || 'ai-assistant').trim() || 'ai-assistant';
        await this.options.upsertSetting(key, value, group);
        results.push({ ok: true, type, key, value });
        continue;
      }

      if (type === 'mcp_call') {
        const tool = String(rawAction?.tool || '').trim();
        const callInput = rawAction?.input && typeof rawAction.input === 'object' ? rawAction.input : {};
        if (!tool) { results.push({ ok: false, type, error: 'Missing MCP tool name' }); continue; }
        const callResult = await mcpBridge.call({ tool, input: callInput, context: { ...context, dryRun } });
        if (!callResult.ok) { results.push({ ok: false, type, tool, input: callInput, error: callResult.error || 'MCP call failed' }); continue; }
        results.push({ ok: true, type, tool, input: callInput, dryRun, output: callResult.output });
        continue;
      }

      results.push({ ok: false, type, error: `Unsupported action type: ${type}` });
    }

    return { success: results.some((item) => item.ok), dryRun, results };
  }
}
