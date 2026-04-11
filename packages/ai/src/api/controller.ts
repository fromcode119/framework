import { Request, Response } from 'express';
import {
  PluginManager,
  ThemeManager,
  TypeUtils,
} from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core/client';
import { AdminAssistantRuntime } from '@fromcode119/ai';
import type { AssistantSkillDefinition, AssistantCollectionContext } from '../admin-assistant-runtime/types';
import type { RESTController } from './controller.types';
import { IDatabaseManager } from '@fromcode119/database';
import { AssistantManagementToolsService } from './forge/management-tools-service';
import { AssistantSessionStore } from './forge/session-store';
import { AssistantCatalogService } from './forge/catalog-service';
import { PluginAssistantDiscoveryService } from './forge/plugin-assistant-discovery-service';
import { AssistantRuntimeFactoryService } from './forge/runtime-factory-service';
import { AssistantRequestPayloadService } from './forge/request-payload-service';
import { EnhancedContextManager } from './forge/enhanced-context-manager';
import { ReasoningChainTracker } from './forge/reasoning-chain-tracker';
import { IntelligentToolSelector } from './forge/intelligent-tool-selector';
import { TaskComplexityDetector } from './forge/task-complexity-detector';
import { AssistantChatHandler } from './helpers/assistant-chat-handler';
import { SessionContinueHandler } from './helpers/session-continue-handler';
import { ExecuteActionsHandler } from './helpers/execute-actions-handler';
import { AssistantModelsHandler } from './helpers/assistant-models-handler';
import { SessionManagementHandlers } from './helpers/session-management-handlers';
import type { ControllerDeps } from './helpers/controller-deps';

const ASSISTANT_PROMPT_BASIC_KEY = 'assistant.prompt.basic';
const ASSISTANT_PROMPT_ADVANCED_KEY = 'assistant.prompt.advanced';
const ASSISTANT_SESSION_KEY_PREFIX = 'assistant.session.';
const ASSISTANT_SESSION_GROUP = 'assistant-session';

export class AssistantController {
  private db: IDatabaseManager;
  private managementTools: AssistantManagementToolsService;
  private sessions: AssistantSessionStore;
  private catalog: AssistantCatalogService;
  private pluginAssistantDiscovery: PluginAssistantDiscoveryService;
  private runtimeFactory: AssistantRuntimeFactoryService;
  private payloadService: AssistantRequestPayloadService;
  private toolSelector: IntelligentToolSelector;
  private complexityDetector: TaskComplexityDetector;
  private activeSessions: Map<string, { context: EnhancedContextManager; reasoning: ReasoningChainTracker }> = new Map();

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    this.db = (manager as any).db;
    this.managementTools = new AssistantManagementToolsService(manager, themeManager);
    this.sessions = new AssistantSessionStore(this.db, ASSISTANT_SESSION_KEY_PREFIX, ASSISTANT_SESSION_GROUP);
    this.catalog = new AssistantCatalogService(manager, themeManager, restController, (value) => this.managementTools.normalizeSearchText(value));
    this.pluginAssistantDiscovery = new PluginAssistantDiscoveryService(manager, this.catalog);
    this.runtimeFactory = new AssistantRuntimeFactoryService(manager, themeManager, restController, this.db, this.managementTools, this.catalog, this.pluginAssistantDiscovery, { basic: ASSISTANT_PROMPT_BASIC_KEY, advanced: ASSISTANT_PROMPT_ADVANCED_KEY });
    this.payloadService = new AssistantRequestPayloadService((input) => this.sessions.normalizeHistory(input));
    this.toolSelector = new IntelligentToolSelector(this.managementTools.buildTools() as any);
    this.complexityDetector = new TaskComplexityDetector();
  }

  private getSessionTrackers(sessionId: string) {
    if (!this.activeSessions.has(sessionId)) {
      this.activeSessions.set(sessionId, { context: new EnhancedContextManager(8000, 2000), reasoning: new ReasoningChainTracker() });
    }
    return this.activeSessions.get(sessionId)!;
  }

  private async restoreSessionContext(sessionId: string, session: any) {
    const trackers = this.getSessionTrackers(sessionId);
    const history = this.sessions.normalizeHistory(session?.history || []);
    for (const entry of history) {
      const importance = trackers.context.scoreImportance(entry.role, entry.content);
      trackers.context.addFrame(entry.role, entry.content, importance, { taskId: sessionId });
    }
    return trackers.context;
  }

  private async prepareContextForLLM(sessionId: string | undefined, incomingHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
    if (!sessionId) return incomingHistory;
    const trackers = this.getSessionTrackers(sessionId);
    for (const entry of incomingHistory) {
      const importance = trackers.context.scoreImportance(entry.role, entry.content);
      trackers.context.addFrame(entry.role, entry.content, importance);
    }
    const contextFrames = trackers.context.getContextForLLM();
    return contextFrames.map((f) => ({ role: f.role, content: f.content }));
  }

  private recordReasoningStep(sessionId: string | undefined, thinking: string, input: Record<string, any>, output: Record<string, any>, confidence: number = 0.5) {
    if (!sessionId) return;
    const trackers = this.getSessionTrackers(sessionId);
    trackers.reasoning.recordStep('decision', thinking, input, output, confidence);
  }

  private getReasoningReport(sessionId: string | undefined): string | null {
    if (!sessionId) return null;
    const trackers = this.activeSessions.get(sessionId);
    return trackers ? trackers.reasoning.generateReasoningReport() : null;
  }

  private trimTrailingSlash(value: string): string {
    return String(value || '').replace(/\/+$/, '');
  }

  private setAssistantDeprecationHeaders(res: Response, replacementPath: string): void {
    const replacement = String(replacementPath || '').trim();
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Fri, 31 Jul 2026 23:59:59 GMT');
    if (replacement) {
      res.setHeader('X-Fromcode-Deprecated', 'true');
      res.setHeader('X-Fromcode-Deprecated-Message', `Deprecated assistant contract. Use ${replacement}.`);
      res.setHeader('Link', `<${replacement}>; rel="successor-version"`);
    }
  }

  private async emitAssistantTelemetry(event: string, payload: Record<string, any>): Promise<void> {
    const body = { event: String(event || '').trim() || 'unknown', timestamp: Date.now(), ...payload };
    try { await this.manager.hooks.call('assistant:telemetry', body); } catch { /* Optional hook */ }
    try { if (typeof (this.manager as any).emit === 'function') (this.manager as any).emit('assistant:telemetry', body); } catch { /* Optional emitter */ }
  }

  private async getStoredAiProviderConfig(providerKey: string): Promise<Record<string, any>> {
    const integration = await this.manager.integrations.getConfig('ai').catch(() => null as any);
    if (!integration) return {};
    const key = String(providerKey || '').trim().toLowerCase();
    const storedProviders = Array.isArray((integration as any).storedProviders) ? (integration as any).storedProviders : [];
    const providerEntry = storedProviders.find((entry: any) => String(entry?.providerKey || '').trim().toLowerCase() === key && entry?.enabled !== false);
    if (providerEntry?.config && typeof providerEntry.config === 'object') return providerEntry.config;
    const activeProvider = String((integration as any)?.active?.provider || '').trim().toLowerCase();
    if (activeProvider === key && (integration as any)?.active?.config) return (integration as any).active.config;
    return {};
  }

  private normalizeAssistantCheckpoint(input: any) {
    if (!input || typeof input !== 'object') return undefined;
    const resumePrompt = String((input as any)?.resumePrompt || '').trim();
    const rawReason = String((input as any)?.reason || '').trim().toLowerCase();
    const reason = ['loop_cap', 'time_cap', 'user_continue', 'clarification_needed', 'loop_recovery'].includes(rawReason) ? rawReason as any : undefined;
    if (!resumePrompt || !reason) return undefined;
    const planningPassesUsedRaw = Number((input as any)?.planningPassesUsed);
    const planningPassesUsed = Number.isFinite(planningPassesUsedRaw) ? Math.max(0, planningPassesUsedRaw) : undefined;
    const rawStage = String((input as any)?.stage || '').trim().toLowerCase();
    const stage = ['classify', 'retrieve', 'plan', 'clarify', 'finalize'].includes(rawStage) ? rawStage as any : undefined;
    const listingMemoryRaw = (input as any)?.memory?.listing;
    const factualMemoryRaw = (input as any)?.memory?.factual;
    const listingCollectionSlug = String(listingMemoryRaw?.collectionSlug || '').trim();
    const listingMemory = listingCollectionSlug ? { collectionSlug: listingCollectionSlug, lastSelectedRowIndex: Number.isFinite(Number(listingMemoryRaw?.lastSelectedRowIndex)) ? Math.max(0, Number(listingMemoryRaw.lastSelectedRowIndex)) : undefined, lastSelectedRecordId: String(listingMemoryRaw?.lastSelectedRecordId || '').trim() || undefined, lastSelectedField: String(listingMemoryRaw?.lastSelectedField || '').trim() || undefined } : undefined;
    const factualTool = String(factualMemoryRaw?.tool || '').trim();
    const factualInput = factualMemoryRaw?.input && typeof factualMemoryRaw.input === 'object'
      ? { ...factualMemoryRaw.input }
      : undefined;
    const factualMetrics = Array.isArray(factualMemoryRaw?.metrics)
      ? factualMemoryRaw.metrics
          .filter((entry: any) => entry && typeof entry === 'object')
          .map((entry: any) => ({
            path: String(entry?.path || '').trim(),
            value: entry?.value,
          }))
          .filter((entry: { path: string; value: unknown }) =>
            !!entry.path && ['string', 'number', 'boolean'].includes(typeof entry.value),
          )
          .slice(0, 24)
      : undefined;
    const factualMemory = factualTool
      ? {
          tool: factualTool,
          input: factualInput,
          rangeLabel: String(factualMemoryRaw?.rangeLabel || '').trim() || undefined,
          rangeFrom: String(factualMemoryRaw?.rangeFrom || '').trim() || undefined,
          rangeTo: String(factualMemoryRaw?.rangeTo || '').trim() || undefined,
          currency: String(factualMemoryRaw?.currency || '').trim() || undefined,
          primaryMetricPath: String(factualMemoryRaw?.primaryMetricPath || '').trim() || undefined,
          metrics: factualMetrics,
        }
      : undefined;
    const memory = listingMemory || factualMemory
      ? {
          ...(listingMemory ? { listing: listingMemory } : {}),
          ...(factualMemory ? { factual: factualMemory } : {}),
        }
      : undefined;
    return { resumePrompt, reason, stage, planningPassesUsed, memory };
  }

  private async resolveAssistantClientFromRequest(req: Request): Promise<{ client: any; provider: string }> {
    const requestedProvider = String(req.body?.provider || '').trim().toLowerCase();
    const requestConfig = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
    if (requestedProvider) {
      try {
        const storedConfig = await this.getStoredAiProviderConfig(requestedProvider);
        const resolved = await (this.manager.integrations as any).instantiateWithConfig('ai', requestedProvider, { ...storedConfig, ...requestConfig });
        if (resolved?.instance && typeof resolved.instance.chat === 'function') return { client: resolved.instance, provider: requestedProvider };
        throw new Error(`Provider "${requestedProvider}" did not return a valid chat client.`);
      } catch { throw new Error(`Unable to initialize requested provider "${requestedProvider}". Check provider config and try again.`); }
    }
    const fallbackClient = await this.manager.integrations.get<any>('ai', true).catch(() => null);
    const fallbackConfig = await this.manager.integrations.getConfig('ai').catch(() => null as any);
    const fallbackProvider = String(fallbackConfig?.active?.provider || requestedProvider || 'openai').trim().toLowerCase();
    return { client: fallbackClient, provider: fallbackProvider };
  }

  private get _deps(): ControllerDeps {
    return {
      db: this.db, manager: this.manager, themeManager: this.themeManager,
      sessions: this.sessions, catalog: this.catalog, runtimeFactory: this.runtimeFactory,
      payloadService: this.payloadService, managementTools: this.managementTools,
      complexityDetector: this.complexityDetector, toolSelector: this.toolSelector,
      activeSessions: this.activeSessions,
      getSessionTrackers: (id) => this.getSessionTrackers(id),
      recordReasoningStep: (id, t, i, o, c) => this.recordReasoningStep(id, t, i, o, c),
      getReasoningReport: (id) => this.getReasoningReport(id),
      emitAssistantTelemetry: (e, p) => this.emitAssistantTelemetry(e, p),
      getStoredAiProviderConfig: (k) => this.getStoredAiProviderConfig(k),
      normalizeAssistantCheckpoint: (i) => this.normalizeAssistantCheckpoint(i),
      prepareContextForLLM: (id, h) => this.prepareContextForLLM(id, h),
      restoreSessionContext: (id, s) => this.restoreSessionContext(id, s),
      resolveAssistantClientFromRequest: (r) => this.resolveAssistantClientFromRequest(r),
      createAssistantRuntime: (r, a) => this.runtimeFactory.createAssistantRuntime(r, a),
      setAssistantDeprecationHeaders: (r, p) => this.setAssistantDeprecationHeaders(r, p),
      trimTrailingSlash: (v) => this.trimTrailingSlash(v),
    };
  }

  async assistantChat(req: Request, res: Response) {
    return AssistantChatHandler.handle(req, res, this._deps);
  }

  async executeAssistantActions(req: Request, res: Response) {
    return ExecuteActionsHandler.handle(req, res, this._deps);
  }

  async assistantTools(req: Request, res: Response) {
    try {
      const runtime = this.runtimeFactory.createAssistantRuntime(req);
      const runtimeToolsRaw = await runtime.listTools(true);
      const frameworkToolsRaw = this.managementTools.buildTools();
      const normalize = (raw: any[]) => (Array.isArray(raw) ? raw : []).map((entry: any) => ({
        tool: String(entry?.tool || '').trim(),
        description: entry?.description ? String(entry.description) : undefined,
        readOnly: entry?.readOnly === true,
        metadata: entry?.metadata && typeof entry.metadata === 'object'
          ? { ...(entry.metadata as Record<string, unknown>) }
          : undefined,
      })).filter((entry) => !!entry.tool);
      const mergedByTool = new Map<string, { tool: string; description?: string; readOnly: boolean; metadata?: Record<string, unknown> }>();
      for (const entry of normalize(runtimeToolsRaw)) mergedByTool.set(entry.tool, entry);
      for (const entry of normalize(frameworkToolsRaw)) { if (!mergedByTool.has(entry.tool)) mergedByTool.set(entry.tool, entry); }
      return res.json({ tools: Array.from(mergedByTool.values()) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant tools' });
    }
  }

  async assistantSkills(req: Request, res: Response) {
    try {
      const runtime = this.runtimeFactory.createAssistantRuntime(req);
      const skills = await runtime.listSkills();
      return res.json({ skills });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant skills' });
    }
  }

  async executeAssistantLegacy(req: Request, res: Response) {
    this.setAssistantDeprecationHeaders(res, '/api/forge/admin/assistant/actions/execute');
    return this.executeAssistantActions(req, res);
  }

  async continueAssistantSession(req: Request, res: Response) {
    return SessionContinueHandler.handle(req, res, this._deps);
  }

  async assistantReasoningReport(req: Request, res: Response) {
    return SessionManagementHandlers.assistantReasoningReport(req, res, this._deps);
  }

  async assistantSessions(req: Request, res: Response) {
    return SessionManagementHandlers.assistantSessions(req, res, this._deps);
  }

  async assistantSession(req: Request, res: Response) {
    return SessionManagementHandlers.assistantSession(req, res, this._deps);
  }

  async forkAssistantSession(req: Request, res: Response) {
    return SessionManagementHandlers.forkAssistantSession(req, res, this._deps);
  }

  async deleteAssistantSession(req: Request, res: Response) {
    return SessionManagementHandlers.deleteAssistantSession(req, res, this._deps);
  }

  async assistantModels(req: Request, res: Response) {
    return AssistantModelsHandler.handle(req, res, this._deps);
  }
}
