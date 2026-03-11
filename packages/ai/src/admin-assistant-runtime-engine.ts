import { McpBridgeFactory, type McpBridge, type McpToolDefinition } from '@fromcode119/mcp';
import { AssistantCopyUtils } from './assistant-copy';
import type {
  AdminAssistantRuntimeOptions,
  AssistantAction,
  AssistantChatInput,
  AssistantChatResult,
  AssistantExecuteInput,
  AssistantExecuteResult,
  AssistantPlanArtifact,
  AssistantPlanStatus,
  AssistantSettingValue,
  AssistantSkillDefinition,
  AssistantSkillRiskPolicy,
  AssistantToolSummary,
  AssistantUiHints,
} from './admin-assistant-runtime/types';
import { OrchestratorRunner } from './admin-assistant-runtime/runtime/orchestrator';
import { ResponseBuilder } from './admin-assistant-runtime/runtime/response';
import { ProviderCapabilitiesUtils } from './gateways/integration-provider';

export class AdminAssistantRuntimeEngine {
  constructor(private readonly options: AdminAssistantRuntimeOptions) {}

  private toRunMode(input: string): 'chat' | 'plan' | 'agent' {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'plan') return 'plan';
    if (value === 'agent') return 'agent';
    return 'chat';
  }

  private defaultSkillCatalog(): AssistantSkillDefinition[] {
    return AssistantCopyUtils.DEFAULT_SKILLS.map((skill) => ({
      ...skill,
      allowedTools: Array.isArray((skill as any).allowedTools) ? [...(skill as any).allowedTools] : undefined,
      entryExamples: Array.isArray((skill as any).entryExamples) ? [...(skill as any).entryExamples] : undefined,
    })) as AssistantSkillDefinition[];
  }

  private normalizeSkills(skills: AssistantSkillDefinition[]): AssistantSkillDefinition[] {
    const seen = new Set<string>();
    const output: AssistantSkillDefinition[] = [];
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
        riskPolicy:
          (String(item.riskPolicy || 'approval_required').trim().toLowerCase() as AssistantSkillRiskPolicy) ||
          'approval_required',
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

  async listSkills(): Promise<AssistantSkillDefinition[]> {
    const defaults = this.defaultSkillCatalog();
    const extra = await Promise.resolve(this.options.resolveSkills?.() || []);
    return this.normalizeSkills([...(Array.isArray(extra) ? extra : []), ...defaults]);
  }

  private async buildBridge(dryRun: boolean): Promise<McpBridge> {
    const tools: McpToolDefinition[] = [];
    const extraTools = await Promise.resolve(this.options.resolveAdditionalTools?.({ dryRun }) || []);
    if (Array.isArray(extraTools)) {
      for (const tool of extraTools) {
        if (!tool || typeof tool !== 'object' || !tool.tool || typeof tool.handler !== 'function') continue;
        tools.push(tool);
      }
    }

    const hasTool = (name: string) => tools.some((tool) => String(tool?.tool || '').trim() === name);
    if (!hasTool('web.search')) {
      tools.push({
        tool: 'web.search',
        readOnly: true,
        description: 'Search the web for current information.',
        handler: async () => ({ ok: false, error: 'web.search is unavailable in this runtime configuration.' }),
      });
    }
    if (!hasTool('web.fetch')) {
      tools.push({
        tool: 'web.fetch',
        readOnly: true,
        description: 'Fetch and summarize a page by URL.',
        handler: async () => ({ ok: false, error: 'web.fetch is unavailable in this runtime configuration.' }),
      });
    }

    return McpBridgeFactory.create({ tools });
  }

  async listTools(dryRun: boolean = true): Promise<AssistantToolSummary[]> {
    const bridge = await this.buildBridge(dryRun);
    return (Array.isArray(bridge.listTools()) ? bridge.listTools() : [])
      .map((tool: any) => ({
        tool: String(tool?.tool || '').trim(),
        description: tool?.description ? String(tool.description) : undefined,
        readOnly: tool?.readOnly === true,
      }))
      .filter((tool) => !!tool.tool);
  }

  private resolveSkillForInput(input: AssistantChatInput, skills: AssistantSkillDefinition[]): AssistantSkillDefinition | undefined {
    const selectedSkillId = String(input?.skillId || 'general').trim().toLowerCase() || 'general';
    return (
      skills.find((skill) => skill.id === selectedSkillId) ||
      skills.find((skill) => skill.id === 'general') ||
      skills[0]
    );
  }

  private resolveAgentMode(input: AssistantChatInput, selectedSkill?: AssistantSkillDefinition): 'basic' | 'advanced' {
    const requestedMode = String(input?.agentMode || '').trim().toLowerCase();
    if (requestedMode === 'advanced' || requestedMode === 'plan' || requestedMode === 'agent') return 'advanced';
    if (requestedMode === 'basic' || requestedMode === 'chat' || requestedMode === 'auto') return 'basic';
    return (selectedSkill?.defaultMode || 'chat') === 'chat' ? 'basic' : 'advanced';
  }

  private buildPlanArtifact(input: {
    planId: string;
    goal: string;
    message: string;
    actions: AssistantAction[];
    traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: AssistantSkillDefinition;
  }): AssistantPlanArtifact {
    const nowIso = (this.options.now || (() => new Date().toISOString()))();
    const hasActions = Array.isArray(input.actions) && input.actions.length > 0;

    let status: AssistantPlanStatus = 'draft';
    if (hasActions) {
      status = input.done ? 'ready_for_apply' : 'ready_for_preview';
    } else if (input.loopCapReached || input.loopTimeLimitReached) {
      status = 'paused';
    } else if (input.done) {
      status = 'completed';
    } else if (Array.isArray(input.traces) && input.traces.length > 0) {
      status = 'searching';
    }

    const hasWriteActions = input.actions.some((action) => {
      if (action.type === 'create_content' || action.type === 'update_setting') return true;
      return action.type === 'mcp_call' && !String(action.tool || '').includes('.search_') && !String(action.tool || '').endsWith('.get');
    });

    const risk: 'low' | 'medium' | 'high' =
      input.selectedSkill?.riskPolicy === 'allowlisted_auto_apply' && hasWriteActions
        ? 'high'
        : input.selectedSkill?.riskPolicy === 'read_only'
          ? 'low'
          : hasWriteActions
            ? 'medium'
            : 'low';

    return {
      id: input.planId,
      status,
      goal: String(input.goal || '').trim() || 'User request',
      summary: String(input.message || '').trim() || (hasActions ? 'Staged actions are ready for preview.' : 'No staged actions yet.'),
      steps: (Array.isArray(input.traces) ? input.traces : []).map((trace, index, all) => ({
        id: `${input.planId}-step-${index + 1}`,
        title: trace?.message
          ? `${trace?.phase ? `${String(trace.phase).charAt(0).toUpperCase()}${String(trace.phase).slice(1)}: ` : ''}${String(trace.message).trim() || `Step ${index + 1}`}`
          : `Step ${index + 1}`,
        status: index === all.length - 1 && status === 'searching' ? 'running' : 'completed',
        description: trace?.message ? String(trace.message).trim() : undefined,
        toolCalls: Array.isArray(trace?.toolCalls) ? trace.toolCalls : [],
      })),
      actions: Array.isArray(input.actions) ? input.actions : [],
      risk,
      previewReady: hasActions,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  private buildUiHints(input: {
    hasActions: boolean;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: AssistantSkillDefinition;
    planningPassesUsed?: number;
    needsClarification?: boolean;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    loopRecoveryMode?: 'none' | 'clarify' | 'best_effort';
  }): AssistantUiHints {
    const suggestedMode = input.hasActions
      ? 'plan'
      : (input.loopCapReached || input.loopTimeLimitReached) && !input.done
        ? 'agent'
        : input.selectedSkill?.defaultMode || 'chat';

    const maxPlanningPasses = 3;
    const passesUsed = Number(input.planningPassesUsed || 0);
    const canContinueMore = passesUsed < maxPlanningPasses;

    return {
      canContinue:
        (input.loopCapReached || input.loopTimeLimitReached) &&
        !input.hasActions &&
        canContinueMore &&
        !input.needsClarification &&
        input.loopRecoveryMode !== 'best_effort',
      requiresApproval: input.hasActions && input.selectedSkill?.riskPolicy !== 'allowlisted_auto_apply',
      suggestedMode,
      showTechnicalDetailsDefault: false,
      nextStep: input.hasActions ? 'preview' : input.needsClarification ? 'reply' : 'reply',
      summaryMode: 'concise',
      needsClarification: !!input.needsClarification,
      clarifyingQuestion: String(input.clarifyingQuestion || '').trim() || undefined,
      missingInputs: Array.isArray(input.missingInputs) ? input.missingInputs.filter(Boolean) : undefined,
      loopRecoveryMode: input.loopRecoveryMode || 'none',
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

  async chat(input: AssistantChatInput): Promise<AssistantChatResult> {
    const aiClient = this.options.aiClient;
    if (!aiClient || typeof aiClient.chat !== 'function') {
      throw new Error('AI Assistant integration is not configured.');
    }

    const message = String(input?.message || '').trim();
    if (!message) {
      throw new Error('message is required');
    }

    const orchestrated = await OrchestratorRunner.runOrchestrator(input, {
      options: this.options,
      resolveSkills: () => this.listSkills(),
      createBridge: (dryRun: boolean) => this.buildBridge(dryRun),
      listTools: (dryRun: boolean) => this.listTools(dryRun),
      sanitizeMessage: (value: string) => ResponseBuilder.stripBannedOpener(value),
      toRunMode: (value: string) => this.toRunMode(value),
      buildPlanArtifact: (value: any) => this.buildPlanArtifact(value),
      buildUiHints: (value: any) => this.buildUiHints(value),
      resolveAgentMode: (payload: AssistantChatInput, selectedSkill?: AssistantSkillDefinition) =>
        this.resolveAgentMode(payload, selectedSkill),
      resolveSkillForInput: (payload: AssistantChatInput, skills: AssistantSkillDefinition[]) =>
        this.resolveSkillForInput(payload, skills),
      resolveProviderCapabilities: (provider: string) => ProviderCapabilitiesUtils.resolveProviderCapabilities(provider),
    });

    if (orchestrated) {
      return orchestrated;
    }

    throw new Error('Assistant runtime engine did not produce a response.');
  }

  async executeActions(input: AssistantExecuteInput): Promise<AssistantExecuteResult> {
    const actions = this.sanitizeActions(Array.isArray(input?.actions) ? input.actions : []);
    const dryRun = input?.dryRun !== false;
    const context = input?.context || {};
    const mcpBridge = await this.buildBridge(dryRun);

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