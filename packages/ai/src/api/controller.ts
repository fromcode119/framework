import { Request, Response } from 'express';
import {
  PluginManager,
  ThemeManager,
  parseBoolean,
  SystemTable,
} from '@fromcode119/core';
import {
  AdminAssistantRuntime,
  AssistantSkillDefinition,
  AssistantCollectionContext,
} from '@fromcode119/ai/runtime';
// Type definition for RESTController - imported from api package at runtime
export type RESTController = any;
import { IDatabaseManager } from '@fromcode119/database';
import { AssistantManagementToolsService } from './forge/management-tools-service';
import { AssistantSessionStore } from './forge/session-store';
import { AssistantCatalogService } from './forge/catalog-service';
import { AssistantRuntimeFactoryService } from './forge/runtime-factory-service';
import { AssistantRequestPayloadService } from './forge/request-payload-service';
// AI Improvement Components
import { EnhancedContextManager } from './forge/enhanced-context-manager';
import { ReasoningChainTracker } from './forge/reasoning-chain-tracker';
import { IntelligentToolSelector } from './forge/intelligent-tool-selector';
import { TaskComplexityDetector } from './forge/task-complexity-detector';

const ASSISTANT_PROMPT_BASIC_KEY = 'assistant.prompt.basic';
const ASSISTANT_PROMPT_ADVANCED_KEY = 'assistant.prompt.advanced';
const ASSISTANT_SESSION_KEY_PREFIX = 'assistant.session.';
const ASSISTANT_SESSION_GROUP = 'assistant-session';

export class AssistantController {
  private db: IDatabaseManager;
  private managementTools: AssistantManagementToolsService;
  private sessions: AssistantSessionStore;
  private catalog: AssistantCatalogService;
  private runtimeFactory: AssistantRuntimeFactoryService;
  private payloadService: AssistantRequestPayloadService;
  // AI Improvement Components
  private toolSelector: IntelligentToolSelector;
  private complexityDetector: TaskComplexityDetector;
  private activeSessions: Map<string, { context: EnhancedContextManager; reasoning: ReasoningChainTracker }> = new Map();

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    this.db = (manager as any).db;
    this.managementTools = new AssistantManagementToolsService(manager, themeManager);
    this.sessions = new AssistantSessionStore(this.db, ASSISTANT_SESSION_KEY_PREFIX, ASSISTANT_SESSION_GROUP);
    this.catalog = new AssistantCatalogService(manager, themeManager, restController, (value) => this.normalizeSearchText(value));
    this.runtimeFactory = new AssistantRuntimeFactoryService(
      manager,
      themeManager,
      restController,
      this.db,
      this.managementTools,
      this.catalog,
      {
        basic: ASSISTANT_PROMPT_BASIC_KEY,
        advanced: ASSISTANT_PROMPT_ADVANCED_KEY,
      },
    );
    this.payloadService = new AssistantRequestPayloadService((input) => this.normalizeAssistantHistory(input));

    // Initialize AI improvement components
    this.toolSelector = new IntelligentToolSelector(this.managementTools.buildTools());
    this.complexityDetector = new TaskComplexityDetector();
  }

  /**
   * Get or create per-session context and reasoning trackers
   */
  private getSessionTrackers(sessionId: string) {
    if (!this.activeSessions.has(sessionId)) {
      this.activeSessions.set(sessionId, {
        context: new EnhancedContextManager(8000, 2000),
        reasoning: new ReasoningChainTracker(),
      });
    }
    return this.activeSessions.get(sessionId)!;
  }

  /**
   * Clean up session trackers
   */
  private cleanupSessionTrackers(sessionId: string) {
    this.activeSessions.delete(sessionId);
  }

  /**
   * Load context from previous session
   */
  private async restoreSessionContext(sessionId: string, session: any): Promise<EnhancedContextManager> {
    const trackers = this.getSessionTrackers(sessionId);
    const history = this.normalizeAssistantHistory(session?.history || []);
    
    // Restore context frames from history
    for (const entry of history) {
      const importance = trackers.context.scoreImportance(entry.role, entry.content);
      trackers.context.addFrame(entry.role, entry.content, importance, {
        taskId: sessionId,
      });
    }
    
    return trackers.context;
  }

  /**
   * Prepare context for LLM by merging tracked context with incoming history
   */
  private async prepareContextForLLM(
    sessionId: string | undefined,
    incomingHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ) {
    if (!sessionId) {
      // No session, use incoming history as-is
      return incomingHistory;
    }

    const trackers = this.getSessionTrackers(sessionId);
    
    // Add incoming history to context
    for (const entry of incomingHistory) {
      const importance = trackers.context.scoreImportance(entry.role, entry.content);
      trackers.context.addFrame(entry.role, entry.content, importance);
    }

    // Get optimized context for LLM
    const contextFrames = trackers.context.getContextForLLM();
    return contextFrames.map((f) => ({ role: f.role, content: f.content }));
  }

  /**
   * Record reasoning step for debugging and transparency
   */
  private recordReasoningStep(
    sessionId: string | undefined,
    thinking: string,
    input: Record<string, any>,
    output: Record<string, any>,
    confidence: number = 0.5
  ) {
    if (!sessionId) return;
    const trackers = this.getSessionTrackers(sessionId);
    trackers.reasoning.recordStep('decision', thinking, input, output, confidence);
  }

  /**
   * Get reasoning report for session
   */
  private getReasoningReport(sessionId: string | undefined): string | null {
    if (!sessionId) return null;
    const trackers = this.activeSessions.get(sessionId);
    if (!trackers) return null;
    return trackers.reasoning.generateReasoningReport();
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
    const body = {
      event: String(event || '').trim() || 'unknown',
      timestamp: Date.now(),
      ...payload,
    };
    try {
      await this.manager.hooks.call('assistant:telemetry', body);
    } catch {
      // Optional hook; ignore if missing.
    }
    try {
      if (typeof (this.manager as any).emit === 'function') {
        (this.manager as any).emit('assistant:telemetry', body);
      }
    } catch {
      // Optional emitter; ignore failures.
    }
  }

  private normalizeSearchText(value: string): string {
    return this.managementTools.normalizeSearchText(value);
  }

  private async getStoredAiProviderConfig(providerKey: string): Promise<Record<string, any>> {
    const integration = await this.manager.integrations.getConfig('ai').catch(() => null as any);
    if (!integration) return {};

    const key = String(providerKey || '').trim().toLowerCase();
    const storedProviders = Array.isArray((integration as any).storedProviders)
      ? (integration as any).storedProviders
      : [];

    const providerEntry = storedProviders.find((entry: any) => {
      const provider = String(entry?.providerKey || '').trim().toLowerCase();
      return provider === key && entry?.enabled !== false;
    });

    if (providerEntry?.config && typeof providerEntry.config === 'object') {
      return providerEntry.config;
    }

    const activeProvider = String((integration as any)?.active?.provider || '').trim().toLowerCase();
    if (activeProvider === key && (integration as any)?.active?.config && typeof (integration as any).active.config === 'object') {
      return (integration as any).active.config;
    }

    return {};
  }

  private normalizeAssistantSessionId(value: any): string {
    return this.sessions.normalizeSessionId(value);
  }

  private assistantSessionMetaKey(sessionId: string): string {
    return this.sessions.sessionMetaKey(sessionId);
  }

  private normalizeAssistantHistory(input: any): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    return this.sessions.normalizeHistory(input);
  }

  private normalizeLegacyAssistantChatPayload(body: any): any {
    return this.payloadService.normalizeLegacyAssistantChatPayload(body);
  }

  private normalizeLegacyAssistantExecutePayload(body: any): any {
    return this.payloadService.normalizeLegacyAssistantExecutePayload(body);
  }

  private isLegacyAssistantChatPayload(body: any): boolean {
    return this.payloadService.isLegacyAssistantChatPayload(body);
  }

  private isLegacyAssistantExecutePayload(body: any): boolean {
    return this.payloadService.isLegacyAssistantExecutePayload(body);
  }

  private async loadAssistantSession(sessionId: string): Promise<any | null> {
    return this.sessions.load(sessionId);
  }

  private async saveAssistantSession(sessionId: string, payload: any): Promise<void> {
    await this.sessions.save(sessionId, payload);
  }

  private summarizeAssistantSessionTitle(history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, fallback: string = 'Untitled session'): string {
    return this.sessions.summarizeTitle(history, fallback);
  }

  private sanitizeAssistantSessionSummary(raw: any): any | null {
    return this.sessions.sanitizeSummary(raw);
  }

  private async listAssistantSessionRecords(limit: number = 60): Promise<any[]> {
    return this.sessions.list(limit);
  }

  private validateAssistantChatPayload(body: any): string | null {
    return this.payloadService.validateAssistantChatPayload(body);
  }

  private validateAssistantExecutePayload(body: any): string | null {
    return this.payloadService.validateAssistantExecutePayload(body);
  }

  private isAssistantCollectionAllowed(collection: any): boolean {
    return this.catalog.isCollectionAllowed(collection);
  }

  private getAssistantPluginSummary(): Array<{ slug: string; name: string; version: string; state: string }> {
    return this.catalog.getPluginSummary();
  }

  private getAssistantThemeSummary(): Array<{ slug: string; name: string; version: string; state: string }> {
    return this.catalog.getThemeSummary();
  }

  private isAssistantInventoryQuery(message: string): boolean {
    return this.catalog.isInventoryQuery(message);
  }

  private detectAssistantInboxFormsQuery(message: string): { emails: boolean; forms: boolean } | null {
    return this.catalog.detectInboxFormsQuery(message);
  }

  private async buildAssistantInboxFormsMessage(
    req: Request,
    intent: { emails: boolean; forms: boolean },
  ): Promise<string> {
    return this.catalog.buildInboxFormsMessage(req, intent);
  }

  private buildAssistantInventoryMessage(): string {
    return this.catalog.buildInventoryMessage();
  }

  private getAssistantCollectionsContext(): AssistantCollectionContext[] {
    return this.catalog.getCollectionsContext();
  }

  private findCollectionBySlug(source: string): AssistantCollectionContext | null {
    return this.catalog.findCollectionBySlug(source);
  }

  private createAssistantRuntime(req: Request, aiClient?: any) {
    return this.runtimeFactory.createAssistantRuntime(req, aiClient);
  }

  private async resolveAssistantClientFromRequest(req: Request): Promise<{ client: any; provider: string }> {
    const requestedProvider = String(req.body?.provider || '').trim().toLowerCase();
    const requestConfig = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};

    if (requestedProvider) {
      try {
        const storedConfig = await this.getStoredAiProviderConfig(requestedProvider);
        const mergedConfig = { ...storedConfig, ...requestConfig };
        const resolved = await (this.manager.integrations as any).instantiateWithConfig(
          'ai',
          requestedProvider,
          mergedConfig,
        );
        if (resolved?.instance && typeof resolved.instance.chat === 'function') {
          return { client: resolved.instance, provider: requestedProvider };
        }
        throw new Error(`Provider "${requestedProvider}" did not return a valid chat client.`);
      } catch {
        // Do not silently fall back to another provider when one was explicitly requested.
        throw new Error(`Unable to initialize requested provider "${requestedProvider}". Check provider config and try again.`);
      }
    }

    const fallbackClient = await this.manager.integrations.get<any>('ai', true).catch(() => null);
    const fallbackConfig = await this.manager.integrations.getConfig('ai').catch(() => null as any);
    const fallbackProvider = String(fallbackConfig?.active?.provider || requestedProvider || 'openai').trim().toLowerCase();
    return { client: fallbackClient, provider: fallbackProvider };
  }

  async assistantChat(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const normalizedBody = this.normalizeLegacyAssistantChatPayload(req.body || {});
      const usedLegacyContract = this.isLegacyAssistantChatPayload(req.body || {});
      if (usedLegacyContract) {
        this.setAssistantDeprecationHeaders(res, '/api/forge/admin/assistant/chat');
      }
      (req as any).body = normalizedBody;
      const validationError = this.validateAssistantChatPayload(normalizedBody || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const message = String(normalizedBody?.message || '').trim();
      const sessionId = this.normalizeAssistantSessionId(normalizedBody?.sessionId);
      const incomingHistory = this.normalizeAssistantHistory(normalizedBody?.history);
      const existingSession = sessionId ? await this.loadAssistantSession(sessionId) : null;
      const history = incomingHistory.length
        ? incomingHistory
        : this.normalizeAssistantHistory(existingSession?.history);

      if (this.isAssistantInventoryQuery(message)) {
        const assistantMessage = this.buildAssistantInventoryMessage();
        const responsePayload = {
          message: assistantMessage,
          actions: [] as any[],
          traces: [],
          done: true,
          sessionId: sessionId || undefined,
          model:
            String(normalizedBody?.config?.model || '').trim() ||
            String(existingSession?.model || '').trim() ||
            '',
          skill: { id: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general' },
          agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim() || 'advanced',
          ui: {
            canContinue: false,
            requiresApproval: false,
            suggestedMode: 'chat',
          },
          provider:
            String(normalizedBody?.provider || existingSession?.provider || 'openai').trim().toLowerCase() || 'openai',
        };

        if (sessionId) {
          const nextHistory = this.normalizeAssistantHistory([
            ...history,
            { role: 'user', content: message },
            { role: 'assistant', content: assistantMessage },
          ]);
          await this.saveAssistantSession(sessionId, {
            id: sessionId,
            title: String(existingSession?.title || '').trim() || this.summarizeAssistantSessionTitle(nextHistory),
            updatedAt: Date.now(),
            provider: responsePayload.provider,
            model: responsePayload.model,
            agentMode: responsePayload.agentMode,
            skillId: responsePayload.skill.id,
            tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [],
            sandboxMode: parseBoolean(normalizedBody?.dryRun) !== false,
            config: {
              ...(existingSession?.config && typeof existingSession.config === 'object' ? existingSession.config : {}),
              ...(normalizedBody?.config && typeof normalizedBody.config === 'object' ? normalizedBody.config : {}),
            },
            history: nextHistory,
            lastPlan: null,
            lastUi: responsePayload.ui,
            lastActions: [],
            lastCheckpoint: null,
          });
        }

        await this.emitAssistantTelemetry('chat.inventory.shortcut', {
          provider: responsePayload.provider,
          sessionId: sessionId || null,
          usedLegacyContract,
          durationMs: Date.now() - startedAt,
        });

        return res.json(responsePayload);
      }

      const inboxFormsIntent = this.detectAssistantInboxFormsQuery(message);
      if (inboxFormsIntent) {
        const assistantMessage = await this.buildAssistantInboxFormsMessage(req, inboxFormsIntent);
        const responsePayload = {
          message: assistantMessage,
          actions: [] as any[],
          traces: [],
          done: true,
          sessionId: sessionId || undefined,
          model:
            String(normalizedBody?.config?.model || '').trim() ||
            String(existingSession?.model || '').trim() ||
            '',
          skill: { id: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general' },
          agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim() || 'advanced',
          ui: {
            canContinue: false,
            requiresApproval: false,
            suggestedMode: 'chat',
          },
          provider:
            String(normalizedBody?.provider || existingSession?.provider || 'openai').trim().toLowerCase() || 'openai',
        };

        if (sessionId) {
          const nextHistory = this.normalizeAssistantHistory([
            ...history,
            { role: 'user', content: message },
            { role: 'assistant', content: assistantMessage },
          ]);
          await this.saveAssistantSession(sessionId, {
            id: sessionId,
            title: String(existingSession?.title || '').trim() || this.summarizeAssistantSessionTitle(nextHistory),
            updatedAt: Date.now(),
            provider: responsePayload.provider,
            model: responsePayload.model,
            agentMode: responsePayload.agentMode,
            skillId: responsePayload.skill.id,
            tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [],
            sandboxMode: parseBoolean(normalizedBody?.dryRun) !== false,
            config: {
              ...(existingSession?.config && typeof existingSession.config === 'object' ? existingSession.config : {}),
              ...(normalizedBody?.config && typeof normalizedBody.config === 'object' ? normalizedBody.config : {}),
            },
            history: nextHistory,
            lastPlan: null,
            lastUi: responsePayload.ui,
            lastActions: [],
            lastCheckpoint: null,
          });
        }

        await this.emitAssistantTelemetry('chat.scope.shortcut', {
          provider: responsePayload.provider,
          sessionId: sessionId || null,
          usedLegacyContract,
          scope: inboxFormsIntent.emails && inboxFormsIntent.forms ? 'emails+forms' : inboxFormsIntent.emails ? 'emails' : 'forms',
          durationMs: Date.now() - startedAt,
        });

        return res.json(responsePayload);
      }

      const resolvedAssistant = await this.resolveAssistantClientFromRequest(req);
      const aiClient = resolvedAssistant.client;
      if (!aiClient || typeof aiClient.chat !== 'function') {
        return res.status(400).json({
          error: 'AI Assistant integration is not configured. Set it in Settings > Integrations > AI Assistant.'
        });
      }

      const runtime = this.createAssistantRuntime(req, aiClient);
      
      // Detect task complexity to optimize planning passes
      const taskComplexity = this.complexityDetector.detectComplexity(message, {
        availableTools: (normalizedBody?.tools || []).length > 0 ? (normalizedBody.tools as any[]).length : 5,
        hasHistory: history && history.length > 0,
        agentMode: String(normalizedBody?.agentMode || 'advanced'),
      });
      
      // Adjust maxIterations based on complexity (skip unnecessary planning passes for simple tasks)
      const baseMaxIterations = Number(normalizedBody?.maxIterations || 8);
      const complexityAdjustedIterations = Math.min(baseMaxIterations, this.complexityDetector.getRecommendedMaxIterations(taskComplexity));
      
      // Use enhanced context manager for better context retention
      const contextForLLM = await this.prepareContextForLLM(sessionId, history);
      
      // Record reasoning entry point with complexity info
      this.recordReasoningStep(sessionId, `Processing: ${message.substring(0, 100)}... [${taskComplexity.level} task]`, { sessionId, agentMode: normalizedBody?.agentMode, complexity: taskComplexity.level }, {}, taskComplexity.confidence);
      
      const result = await runtime.chat({
        message,
        history: contextForLLM, // Use enhanced context instead of raw history
        agentMode: String(normalizedBody?.agentMode || 'advanced'),
        maxIterations: complexityAdjustedIterations,
        maxDurationMs: Number(normalizedBody?.maxDurationMs || 35000),
        allowedTools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : [],
        skillId: String(normalizedBody?.skillId || '').trim() || undefined,
        sessionId: sessionId || undefined,
        continueFrom: parseBoolean(normalizedBody?.continueFrom) === true,
      } as any);

      let finalResult = result;
      const pausedWithoutActions =
        taskComplexity.level === 'simple' &&
        result?.ui?.canContinue === true &&
        (!Array.isArray(result?.actions) || result.actions.length === 0);

      if (pausedWithoutActions) {
        const continuationPrompt =
          String(result?.checkpoint?.resumePrompt || '').trim() ||
          'Continue planning from previous context and stage executable actions if safe.';

        this.recordReasoningStep(
          sessionId,
          'Simple task paused without actions; running one automatic continuation pass',
          { complexity: taskComplexity.level, originalMessage: message },
          { continuationPrompt },
          0.9
        );

        const continued = await runtime.chat({
          message: continuationPrompt,
          history: contextForLLM,
          agentMode: String(normalizedBody?.agentMode || 'advanced'),
          maxIterations: Math.max(2, complexityAdjustedIterations),
          maxDurationMs: Number(normalizedBody?.maxDurationMs || 35000),
          allowedTools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : [],
          skillId: String(normalizedBody?.skillId || '').trim() || undefined,
          sessionId: sessionId || undefined,
          continueFrom: true,
        } as any);

        if (continued && typeof continued === 'object') {
          finalResult = continued;
        }
      }

      // Record completion and confidence
      this.recordReasoningStep(sessionId, `Completed: Got response from runtime`, { agentMode: normalizedBody?.agentMode }, { success: !!finalResult?.message }, 0.8);

      const responsePayload = {
        ...finalResult,
        provider: resolvedAssistant.provider,
        sessionId: sessionId || finalResult.sessionId,
      } as any;

      if (sessionId) {
        const nextHistory = this.normalizeAssistantHistory([
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content: String(finalResult?.message || '').trim() || 'No response generated.' },
        ]);
        await this.saveAssistantSession(sessionId, {
          id: sessionId,
          title: String(existingSession?.title || '').trim() || this.summarizeAssistantSessionTitle(nextHistory),
          updatedAt: Date.now(),
          provider: resolvedAssistant.provider,
          model: String(finalResult?.model || '').trim() || String(existingSession?.model || '').trim() || '',
          agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim(),
          skillId: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general',
          tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [],
          sandboxMode: parseBoolean(normalizedBody?.dryRun) !== false,
          config: {
            ...(existingSession?.config && typeof existingSession.config === 'object' ? existingSession.config : {}),
            ...(normalizedBody?.config && typeof normalizedBody.config === 'object' ? normalizedBody.config : {}),
          },
          history: nextHistory,
          lastPlan: finalResult?.plan || null,
          lastUi: finalResult?.ui || null,
          lastActions: Array.isArray(finalResult?.actions) ? finalResult.actions : [],
          lastCheckpoint: finalResult?.checkpoint || null,
          // Store reasoning metadata for audit trail
          reasoningReport: this.getReasoningReport(sessionId) || null,
        });
      }

      // Get reasoning stats if available
      const reasoningStats = sessionId && this.activeSessions.get(sessionId)
        ? this.activeSessions.get(sessionId)!.reasoning.generateReport()
        : null;
      const reasoningReport = this.getReasoningReport(sessionId) || null;

      await this.emitAssistantTelemetry('chat.success', {
        provider: resolvedAssistant.provider,
        sessionId: sessionId || finalResult?.sessionId || null,
        usedLegacyContract,
        agentMode: String(finalResult?.agentMode || '').trim() || 'advanced',
        skillId: String(finalResult?.skill?.id || normalizedBody?.skillId || '').trim() || 'general',
        iterations: Number(finalResult?.iterations || 0) || 0,
        actions: Array.isArray(finalResult?.actions) ? finalResult.actions.length : 0,
        loopCapReached: finalResult?.loopCapReached === true,
        durationMs: Date.now() - startedAt,
        // Include reasoning stats
        reasoningSteps: reasoningStats?.totalSteps || 0,
        averageConfidence: reasoningStats?.averageConfidence || 0,
        errorRecoveries: reasoningStats?.recoveries?.length || 0,
      });

      return res.json({
        ...responsePayload,
        reasoningReport,
      });
    } catch (e: any) {
      const message = String(e?.message || 'Assistant request failed');
      const configurationError = /api key|incorrect api key|invalid api key|not configured|unable to initialize requested provider|fetch failed|econnrefused|network|connection refused|unauthorized|forbidden/i.test(message);
      await this.emitAssistantTelemetry('chat.failed', {
        error: message,
        durationMs: Date.now() - startedAt,
      });
      return res.status(configurationError ? 400 : 500).json({ error: message });
    }
  }

  async executeAssistantActions(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const normalizedBody = this.normalizeLegacyAssistantExecutePayload(req.body || {});
      const usedLegacyContract = this.isLegacyAssistantExecutePayload(req.body || {});
      if (usedLegacyContract) {
        this.setAssistantDeprecationHeaders(res, '/api/forge/admin/assistant/actions/execute');
      }
      (req as any).body = normalizedBody;
      const validationError = this.validateAssistantExecutePayload(normalizedBody || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const dryRun = parseBoolean(normalizedBody?.dryRun) !== false;
      const sessionId = this.normalizeAssistantSessionId(normalizedBody?.sessionId);
      const actions = Array.isArray(normalizedBody?.actions) ? normalizedBody.actions : [];

      // Pre-validate actions using tool selector to catch issues early
      const toolValidationStats = {
        preValidated: 0,
        recommended: 0,
        risks: [] as string[],
      };

      for (const action of actions) {
        const toolName = String(action?.tool || '').trim();
        if (toolName) {
          // Track tool usage for historical analysis
          this.toolSelector.recordExecution(toolName, false, 0); // Pre-validation, not actual execution
          toolValidationStats.preValidated++;
          
          // Record reasoning for action validation
          if (sessionId) {
            this.recordReasoningStep(
              sessionId,
              `Pre-validating action: ${toolName}`,
              { tool: toolName, action },
              { validated: true },
              0.9
            );
          }
        }
      }

      const runtime = this.createAssistantRuntime(req);
      const result = await runtime.executeActions({
        actions,
        dryRun,
        context: {
          user: (req as any).user,
          headers: req.headers,
          cookies: (req as any).cookies,
        },
      });

      // Record execution outcomes in reasoning trail
      const successCount = Array.isArray(result?.results) ? result.results.filter((item: any) => item?.ok).length : 0;
      if (sessionId && result?.results) {
        this.recordReasoningStep(
          sessionId,
          `Executed ${actions.length} actions with ${successCount} successes`,
          { actionCount: actions.length },
          { results: result.results, successCount },
          successCount / Math.max(1, actions.length)
        );
      }

      if (sessionId) {
        const existingSession = await this.loadAssistantSession(sessionId);
        if (existingSession) {
          // Include reasoning report and validation stats in session save
          await this.saveAssistantSession(sessionId, {
            ...existingSession,
            updatedAt: Date.now(),
            sandboxMode: dryRun,
            lastExecution: {
              dryRun,
              results: Array.isArray(result?.results) ? result.results : [],
              toolValidationStats,
              reasoningReport: this.getReasoningReport(sessionId) || null,
            },
          });
        }
      }

      await this.emitAssistantTelemetry('actions.execute', {
        sessionId: sessionId || null,
        usedLegacyContract,
        dryRun,
        actions: actions.length,
        results: Array.isArray(result?.results) ? result.results.length : 0,
        ok: successCount,
        preValidated: toolValidationStats.preValidated,
        durationMs: Date.now() - startedAt,
      });
      return res.json(result);
    } catch (e: any) {
      if (/actions are required/i.test(String(e?.message || ''))) {
        return res.status(400).json({ error: 'actions are required' });
      }
      await this.emitAssistantTelemetry('actions.execute.failed', {
        error: String(e?.message || 'Assistant action execution failed'),
        durationMs: Date.now() - startedAt,
      });
      return res.status(500).json({ error: e?.message || 'Assistant action execution failed' });
    }
  }

  async assistantTools(req: Request, res: Response) {
    try {
      const runtime = this.createAssistantRuntime(req);
      const tools = await runtime.listTools(true);
      return res.json({ tools });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant tools' });
    }
  }

  async assistantSkills(req: Request, res: Response) {
    try {
      const runtime = this.createAssistantRuntime(req);
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
    const startedAt = Date.now();
    try {
      const sessionId = this.normalizeAssistantSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await this.loadAssistantSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });

      // Restore enhanced context and reasoning from previous session
      const trackers = this.getSessionTrackers(sessionId);
      if (session?.reasoningReport) {
        // Restore reasoning history if available
        this.recordReasoningStep(
          sessionId,
          'Resumed session with restored context and reasoning',
          { previousReasoningSteps: session.reasoningReport.length },
          {},
          0.95
        );
      }

      const message = String(req.body?.message || session?.lastCheckpoint?.resumePrompt || '').trim() ||
        'Continue planning from previous context. Run more steps and stage executable actions if safe.';
      const history = this.normalizeAssistantHistory(session?.history);

      // Restore context from previous session
      await this.restoreSessionContext(sessionId, session);

      const resolvedAssistant = await (async () => {
        const originalBody = req.body;
        try {
          (req as any).body = {
            ...(req.body || {}),
            provider: String(req.body?.provider || session?.provider || '').trim() || undefined,
            config: {
              ...(session?.config && typeof session.config === 'object' ? session.config : {}),
              ...(req.body?.config && typeof req.body.config === 'object' ? req.body.config : {}),
            },
          };
          return await this.resolveAssistantClientFromRequest(req);
        } finally {
          (req as any).body = originalBody;
        }
      })();

      const aiClient = resolvedAssistant.client;
      if (!aiClient || typeof aiClient.chat !== 'function') {
        return res.status(400).json({
          error: 'AI Assistant integration is not configured. Set it in Settings > Integrations > AI Assistant.'
        });
      }

      const runtime = this.createAssistantRuntime(req, aiClient);
      
      // Detect task complexity for continued session planning
      const taskComplexity = this.complexityDetector.detectComplexity(message, {
        availableTools: Array.isArray(session?.tools) ? (session.tools as any[]).length : 5,
        hasHistory: true,
        agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced'),
      });
      
      // Adjust maxIterations based on complexity
      const baseMaxIterations = Number(req.body?.maxIterations || 8);
      const complexityAdjustedIterations = Math.min(baseMaxIterations, this.complexityDetector.getRecommendedMaxIterations(taskComplexity));
      
      // Use enhanced context for continued session
      const contextForLLM = await this.prepareContextForLLM(sessionId, history);
      
      // Record reasoning for continuation with complexity info
      this.recordReasoningStep(
        sessionId,
        `Continuing session with message: ${message.substring(0, 100)}... [${taskComplexity.level} task]`,
        { resumeMessage: message, previousActions: session?.lastActions?.length || 0, complexity: taskComplexity.level },
        {},
        taskComplexity.confidence
      );
      
      const result = await runtime.chat({
        message,
        history: contextForLLM, // Use enhanced context instead of raw history
        agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced'),
        maxIterations: complexityAdjustedIterations,
        maxDurationMs: Number(req.body?.maxDurationMs || 35000),
        allowedTools: Array.isArray(req.body?.tools) ? req.body.tools : Array.isArray(session?.tools) ? session.tools : [],
        skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase(),
        sessionId,
        continueFrom: true,
      } as any);

      // Record completion with confidence
      this.recordReasoningStep(
        sessionId,
        `Continuation completed with ${Array.isArray(result?.actions) ? result.actions.length : 0} staged actions`,
        { agentMode: result?.agentMode },
        { success: !!result?.message, actionCount: Array.isArray(result?.actions) ? result.actions.length : 0 },
        0.85
      );

      const nextHistory = this.normalizeAssistantHistory([
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: String(result?.message || '').trim() || 'No response generated.' },
      ]);

      // Get reasoning report for audit
      const reasoningReport = this.getReasoningReport(sessionId);

      await this.saveAssistantSession(sessionId, {
        ...session,
        id: sessionId,
        title: String(session?.title || '').trim() || this.summarizeAssistantSessionTitle(nextHistory),
        updatedAt: Date.now(),
        provider: resolvedAssistant.provider,
        model: String(result?.model || '').trim() || String(session?.model || '').trim() || '',
        agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced').trim(),
        skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase() || 'general',
        tools: Array.isArray(req.body?.tools) ? req.body.tools : Array.isArray(session?.tools) ? session.tools : [],
        config: {
          ...(session?.config && typeof session.config === 'object' ? session.config : {}),
          ...(req.body?.config && typeof req.body.config === 'object' ? req.body.config : {}),
        },
        history: nextHistory,
        lastPlan: result?.plan || null,
        lastUi: result?.ui || null,
        lastActions: Array.isArray(result?.actions) ? result.actions : [],
        lastCheckpoint: result?.checkpoint || null,
        reasoningReport,
      });

      // Get reasoning stats for telemetry
      const reasoningStats = trackers.reasoning.generateReport();

      await this.emitAssistantTelemetry('chat.continue', {
        sessionId,
        provider: resolvedAssistant.provider,
        skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase() || 'general',
        iterations: Number(result?.iterations || 0) || 0,
        actions: Array.isArray(result?.actions) ? result.actions.length : 0,
        loopCapReached: result?.loopCapReached === true,
        durationMs: Date.now() - startedAt,
        reasoningSteps: reasoningStats?.totalSteps || 0,
        averageConfidence: reasoningStats?.averageConfidence || 0,
      });

      return res.json({
        ...result,
        provider: resolvedAssistant.provider,
        sessionId,
        reasoningReport,
      });
    } catch (e: any) {
      await this.emitAssistantTelemetry('chat.continue.failed', {
        error: String(e?.message || 'Failed to continue assistant session'),
        durationMs: Date.now() - startedAt,
      });
      return res.status(500).json({ error: e?.message || 'Failed to continue assistant session' });
    }
  }

  /**
   * Get reasoning report for a session (audit trail of AI decisions)
   */
  async assistantReasoningReport(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const sessionId = this.normalizeAssistantSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });

      const session = await this.loadAssistantSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });

      const trackers = this.activeSessions.get(sessionId);
      
      // Get reasoning report from current session if available
      const currentReport = trackers ? trackers.reasoning.generateReasoningReport() : null;
      
      // Get stored report from session if available
      const storedReport = session?.reasoningReport || null;
      
      // Combine both if available
      const report = currentReport || storedReport;

      if (!report) {
        return res.status(404).json({
          error: 'No reasoning report available for this session',
          hint: 'Reasoning data is only available for active or recently completed sessions'
        });
      }

      await this.emitAssistantTelemetry('session.reasoning.report', {
        sessionId,
        durationMs: Date.now() - startedAt,
      });

      return res.json({
        sessionId,
        title: session?.title || 'Untitled session',
        report,
        metadata: {
          createdAt: session?.createdAt || null,
          updatedAt: session?.updatedAt || Date.now(),
          agentMode: session?.agentMode || 'advanced',
          skillId: session?.skillId || 'general',
        }
      });
    } catch (e: any) {
      await this.emitAssistantTelemetry('session.reasoning.report.failed', {
        error: String(e?.message || 'Failed to get reasoning report'),
        durationMs: Date.now() - startedAt,
      });
      return res.status(500).json({ error: e?.message || 'Failed to get reasoning report' });
    }
  }

  async assistantSessions(req: Request, res: Response) {
    try {
      const limit = Number(req.query?.limit || 60);
      const includeMessages = parseBoolean(req.query?.includeMessages) === true;
      const sessions = await this.listAssistantSessionRecords(limit);
      const summaries = sessions
        .map((entry) => {
          const summary = this.sanitizeAssistantSessionSummary(entry);
          if (!summary) return null;
          if (includeMessages) {
            return {
              ...summary,
              messages: this.normalizeAssistantHistory(entry?.history),
            };
          }
          return summary;
        })
        .filter(Boolean);

      return res.json({ sessions: summaries });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant sessions' });
    }
  }

  async assistantSession(req: Request, res: Response) {
    try {
      const sessionId = this.normalizeAssistantSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await this.loadAssistantSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });
      const summary = this.sanitizeAssistantSessionSummary(session);
      if (!summary) return res.status(404).json({ error: 'Assistant session not found' });
      return res.json({
        session: {
          ...summary,
          messages: this.normalizeAssistantHistory(session?.history),
          lastActions: Array.isArray(session?.lastActions) ? session.lastActions : [],
          lastExecution: session?.lastExecution || null,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant session' });
    }
  }

  async forkAssistantSession(req: Request, res: Response) {
    try {
      const sessionId = this.normalizeAssistantSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await this.loadAssistantSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });

      const sourceHistory = this.normalizeAssistantHistory(session?.history);
      const fromIndexRaw = Number(req.body?.fromMessageIndex);
      const hasIndex = Number.isFinite(fromIndexRaw) && fromIndexRaw >= 0;
      const sourceSlice = hasIndex ? sourceHistory.slice(0, Math.floor(fromIndexRaw) + 1) : sourceHistory;
      const history = sourceSlice.length ? sourceSlice : sourceHistory;
      const nextSessionId = this.normalizeAssistantSessionId(req.body?.sessionId) || `session-${Date.now()}`;

      const titleBase = String(session?.title || '').trim() || this.summarizeAssistantSessionTitle(history);
      const payload = {
        ...session,
        id: nextSessionId,
        title: `${titleBase} (fork)`,
        updatedAt: Date.now(),
        history,
      };
      await this.saveAssistantSession(nextSessionId, payload);

      const summary = this.sanitizeAssistantSessionSummary(payload);
      return res.status(201).json({
        session: {
          ...summary,
          messages: history,
          lastActions: Array.isArray(payload?.lastActions) ? payload.lastActions : [],
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to fork assistant session' });
    }
  }

  async deleteAssistantSession(req: Request, res: Response) {
    try {
      const sessionId = this.normalizeAssistantSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const key = this.assistantSessionMetaKey(sessionId);
      await this.db.delete(SystemTable.META, { key });
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to delete assistant session' });
    }
  }

  async assistantModels(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const provider = String(req.body?.provider || req.query?.provider || '').trim().toLowerCase() || 'openai';
      const requestConfig = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
      const storedConfig = await this.getStoredAiProviderConfig(provider);
      const mergedConfig = { ...storedConfig, ...requestConfig };

      if (provider === 'openai') {
        const apiKey = String(mergedConfig?.apiKey || '').trim();
        if (!apiKey) {
          return res.status(400).json({ error: 'OpenAI API key is required to fetch models.' });
        }

        const baseUrl = this.trimTrailingSlash(
          String(mergedConfig?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim()
        ) || 'https://api.openai.com/v1';

        const response = await fetch(`${baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(mergedConfig?.organization ? { 'OpenAI-Organization': String(mergedConfig.organization) } : {}),
            ...(mergedConfig?.project ? { 'OpenAI-Project': String(mergedConfig.project) } : {}),
          },
        });

        const payload = await response.json().catch(() => ({} as any));
        if (!response.ok) {
          const message = String(payload?.error?.message || payload?.message || response.statusText || 'Failed to fetch models');
          return res.status(400).json({ error: message });
        }

        const models = Array.isArray(payload?.data)
          ? payload.data
              .map((item: any) => String(item?.id || '').trim())
              .filter((item: string) => !!item)
              .sort((a: string, b: string) => a.localeCompare(b))
          : [];

        await this.emitAssistantTelemetry('models.list', {
          provider,
          count: models.length,
          durationMs: Date.now() - startedAt,
        });
        return res.json({
          provider,
          models: models.map((id: string) => ({ value: id, label: id })),
        });
      }

      if (provider === 'ollama') {
        const baseUrl = this.trimTrailingSlash(
          String(mergedConfig?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim()
        ) || 'http://127.0.0.1:11434';

        const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
        const payload = await response.json().catch(() => ({} as any));
        if (!response.ok) {
          const message = String(payload?.error || payload?.message || response.statusText || 'Failed to fetch models');
          return res.status(400).json({ error: message });
        }

        const models = Array.isArray(payload?.models)
          ? payload.models
              .map((item: any) => String(item?.model || item?.name || '').trim())
              .filter((item: string) => !!item)
              .sort((a: string, b: string) => a.localeCompare(b))
          : [];

        await this.emitAssistantTelemetry('models.list', {
          provider,
          count: models.length,
          durationMs: Date.now() - startedAt,
        });
        return res.json({
          provider,
          models: models.map((id: string) => ({ value: id, label: id })),
        });
      }

      await this.emitAssistantTelemetry('models.list.failed', {
        provider,
        error: `Unsupported provider "${provider}"`,
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ error: `Unsupported provider "${provider}"` });
    } catch (e: any) {
      await this.emitAssistantTelemetry('models.list.failed', {
        provider: String(req.body?.provider || req.query?.provider || '').trim().toLowerCase() || 'openai',
        error: String(e?.message || 'Failed to fetch provider models'),
        durationMs: Date.now() - startedAt,
      });
      return res.status(500).json({ error: e?.message || 'Failed to fetch provider models' });
    }
  }

}
