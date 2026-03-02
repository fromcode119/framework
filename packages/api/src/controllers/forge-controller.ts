import { Request, Response } from 'express';
import {
  AssistantCollectionContext,
  PluginManager,
  ThemeManager,
  parseBoolean,
  SystemTable,
} from '@fromcode119/core';
import {
  AdminAssistantRuntime,
  ForgeSkillDefinition,
} from '@fromcode119/ai/runtime';
import { RESTController } from './rest-controller';
import { IDatabaseManager } from '@fromcode119/database';
import { ForgeManagementToolsService } from './forge/management-tools-service';
import { ForgeSessionStore } from './forge/session-store';
import { ForgeCatalogService } from './forge/catalog-service';

const ASSISTANT_PROMPT_BASIC_KEY = 'assistant.prompt.basic';
const ASSISTANT_PROMPT_ADVANCED_KEY = 'assistant.prompt.advanced';
const ASSISTANT_SESSION_KEY_PREFIX = 'assistant.session.';
const ASSISTANT_SESSION_GROUP = 'assistant-session';

export class ForgeController {
  private db: IDatabaseManager;
  private managementTools: ForgeManagementToolsService;
  private sessions: ForgeSessionStore;
  private catalog: ForgeCatalogService;

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    this.db = (manager as any).db;
    this.managementTools = new ForgeManagementToolsService(manager, themeManager);
    this.sessions = new ForgeSessionStore(this.db, ASSISTANT_SESSION_KEY_PREFIX, ASSISTANT_SESSION_GROUP);
    this.catalog = new ForgeCatalogService(manager, themeManager, restController, (value) => this.normalizeSearchText(value));
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

  private buildAssistantManagementTools() {
    return this.managementTools.buildTools();
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
    const source = body && typeof body === 'object' ? body : {};
    const normalized: any = { ...source };
    const messages = Array.isArray(source?.messages) ? source.messages : [];

    if (!String(normalized?.message || '').trim()) {
      const prompt = String(source?.prompt || source?.text || '').trim();
      if (prompt) {
        normalized.message = prompt;
      } else if (messages.length) {
        const normalizedMessages = this.normalizeAssistantHistory(messages);
        const lastUserIndex = [...normalizedMessages]
          .map((item, index) => ({ item, index }))
          .reverse()
          .find((entry) => entry.item.role === 'user');
        if (lastUserIndex) {
          normalized.message = lastUserIndex.item.content;
          normalized.history = normalizedMessages.slice(0, lastUserIndex.index);
        } else if (normalizedMessages.length) {
          normalized.message = normalizedMessages[normalizedMessages.length - 1].content;
          normalized.history = normalizedMessages.slice(0, -1);
        }
      }
    } else if (!Array.isArray(normalized?.history) && messages.length) {
      normalized.history = this.normalizeAssistantHistory(messages);
    }

    if (!String(normalized?.agentMode || '').trim()) {
      const mode = String(source?.mode || source?.workspaceMode || '').trim().toLowerCase();
      if (mode === 'plan' || mode === 'agent' || mode === 'advanced') {
        normalized.agentMode = 'advanced';
      } else if (mode === 'chat' || mode === 'simple' || mode === 'basic') {
        normalized.agentMode = 'basic';
      }
    }

    if (!String(normalized?.skillId || '').trim()) {
      const persona = String(source?.persona || source?.profile || '').trim();
      if (persona) normalized.skillId = persona.toLowerCase();
    }

    if (!Array.isArray(normalized?.tools) && Array.isArray(source?.allowedTools)) {
      normalized.tools = source.allowedTools;
    }

    return normalized;
  }

  private normalizeLegacyAssistantExecutePayload(body: any): any {
    const source = body && typeof body === 'object' ? body : {};
    const normalized: any = { ...source };
    if (!Array.isArray(normalized?.actions) && Array.isArray(source?.stagedActions)) {
      normalized.actions = source.stagedActions;
    }
    if (normalized?.dryRun === undefined) {
      if (typeof source?.preview === 'boolean') normalized.dryRun = source.preview;
      if (typeof source?.sandbox === 'boolean') normalized.dryRun = source.sandbox;
    }
    return normalized;
  }

  private isLegacyAssistantChatPayload(body: any): boolean {
    const source = body && typeof body === 'object' ? body : {};
    const hasCanonical = !!String(source?.message || '').trim();
    if (hasCanonical) return false;
    return (
      Array.isArray(source?.messages) ||
      !!String(source?.prompt || source?.text || '').trim() ||
      !!String(source?.persona || source?.profile || '').trim() ||
      !!String(source?.mode || source?.workspaceMode || '').trim()
    );
  }

  private isLegacyAssistantExecutePayload(body: any): boolean {
    const source = body && typeof body === 'object' ? body : {};
    return !Array.isArray(source?.actions) && Array.isArray(source?.stagedActions);
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
    const message = String(body?.message || '').trim();
    if (!message) return 'message is required';
    if (body?.history !== undefined && !Array.isArray(body.history)) return 'history must be an array';
    if (body?.tools !== undefined && !Array.isArray(body.tools)) return 'tools must be an array';
    return null;
  }

  private validateAssistantExecutePayload(body: any): string | null {
    if (!Array.isArray(body?.actions) || body.actions.length === 0) return 'actions are required';
    return null;
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
    const user = (req as any).user;
    const resolveAssistantContentItem = async (collection: AssistantCollectionContext, selector: any) => {
      const rawCollection: any = collection.raw || collection;
      const primaryKey = String(rawCollection?.primaryKey || 'id');
      const fieldNames = Array.isArray(rawCollection?.fields)
        ? rawCollection.fields.map((field: any) => String(field?.name || '').trim()).filter(Boolean)
        : [];
      const idCandidate = selector?.id;

      if (idCandidate !== undefined && idCandidate !== null && String(idCandidate).trim() !== '') {
        const rawId = String(idCandidate).trim();
        const numericId = Number(rawId);
        const canUseIdLookup = primaryKey !== 'id' || Number.isInteger(numericId);

        if (canUseIdLookup) {
          try {
            const foundByPrimary = await this.restController.findOne(rawCollection, {
              params: { id: primaryKey === 'id' ? String(numericId) : rawId },
              query: { preview: true },
              user,
              headers: req.headers,
              cookies: (req as any).cookies,
            });
            if (foundByPrimary) return foundByPrimary;
          } catch {
            // Fall back to field-based lookup.
          }
        }

        const idCandidates = Array.from(
          new Set([primaryKey, 'id', '_id', 'uuid'].filter((field) => fieldNames.includes(field)))
        );
        const valuesToTry = Number.isFinite(numericId) && String(numericId) === rawId
          ? [numericId, rawId]
          : [rawId];

        for (const field of idCandidates) {
          for (const candidateValue of valuesToTry) {
            try {
              const result = await this.restController.find(rawCollection, {
                query: {
                  [field]: candidateValue,
                  limit: 1,
                  offset: 0,
                  preview: true,
                },
                user,
                headers: req.headers,
                cookies: (req as any).cookies,
              });
              if (Array.isArray(result?.docs) && result.docs.length) {
                return result.docs[0];
              }
            } catch {
              // Try next candidate field/value.
            }
          }
        }
      }

      const where = selector?.where && typeof selector.where === 'object' ? selector.where : null;
      if (where) {
        const result = await this.restController.find(rawCollection, {
          query: {
            ...where,
            limit: 1,
            offset: 0,
            preview: true,
          },
          user,
          headers: req.headers,
          cookies: (req as any).cookies,
        });
        return Array.isArray(result?.docs) && result.docs.length ? result.docs[0] : null;
      }

      const slugCandidate = String(selector?.slug || '').trim();
      const permalinkCandidate = String(selector?.permalink || '').trim();
      const fallbackValue = slugCandidate || permalinkCandidate;
      if (!fallbackValue) return null;

      const priorityFields = ['slug', 'permalink', 'customPermalink', 'path', 'url', 'title', 'name', 'label', primaryKey];
      const candidates = Array.from(new Set(priorityFields.filter((field) => fieldNames.includes(field))));
      if (candidates.length === 0) return null;

      for (const field of candidates) {
        try {
          const result = await this.restController.find(rawCollection, {
            query: {
              [field]: fallbackValue,
              limit: 1,
              offset: 0,
              preview: true,
            },
            user,
            headers: req.headers,
            cookies: (req as any).cookies,
          });
          if (Array.isArray(result?.docs) && result.docs.length) {
            return result.docs[0];
          }
        } catch {
          // Try next candidate field.
        }
      }

      return null;
    };

    return new AdminAssistantRuntime({
      aiClient: aiClient || null,
      getCollections: () => this.getAssistantCollectionsContext(),
      getPlugins: () => this.manager.getSortedPlugins(this.manager.getPlugins()).map((plugin: any) => ({
        slug: String(plugin?.manifest?.slug || '').trim(),
        name: String(plugin?.manifest?.name || plugin?.manifest?.slug || '').trim(),
        version: String(plugin?.manifest?.version || '0').trim(),
        state: String(plugin?.state || 'unknown').trim(),
        capabilities: Array.isArray(plugin?.manifest?.capabilities) ? plugin.manifest.capabilities : [],
      })),
      getThemes: () => this.themeManager.getThemes().map((theme: any) => ({
        slug: String(theme?.slug || '').trim(),
        name: String(theme?.name || theme?.slug || '').trim(),
        version: String(theme?.version || '').trim(),
        state: String(theme?.state || 'inactive').trim(),
      })),
      findCollectionBySlug: (source: string) => this.findCollectionBySlug(source),
      listContent: async (collection, options) => {
        const rawCollection = collection.raw || collection;
        const limit = Math.min(100, Math.max(1, Number(options?.limit || 20)));
        const offset = Math.max(0, Number(options?.offset || 0));
        const result = await this.restController.find(rawCollection, {
          query: {
            limit,
            offset,
            preview: true,
          },
          user,
          headers: req.headers,
          cookies: (req as any).cookies,
        });
        return {
          docs: Array.isArray(result?.docs) ? result.docs : [],
          totalDocs: Number(result?.totalDocs || 0),
          limit,
          offset,
        };
      },
      resolveContent: async (collection, selector) => {
        return resolveAssistantContentItem(collection, selector || {});
      },
      createContent: async (collection, payload) => {
        const rawCollection = collection.raw || collection;
        return this.restController.create(rawCollection, {
          body: payload,
          query: {},
          params: {},
          user,
          headers: req.headers,
          cookies: (req as any).cookies,
        });
      },
      updateContent: async (collection, targetId, payload) => {
        const rawCollection: any = collection.raw || collection;
        const primaryKey = String(rawCollection?.primaryKey || 'id');
        const whereField = primaryKey === 'id' ? 'id' : primaryKey;

        const existing = await resolveAssistantContentItem(collection, {
          id: targetId,
        });
        const resolvedId = existing && typeof existing === 'object'
          ? (existing as any)[whereField] ?? (existing as any).id ?? targetId
          : targetId;

        return this.restController.update(rawCollection, {
          body: payload,
          query: {},
          params: { id: String(resolvedId) },
          user,
          headers: req.headers,
          cookies: (req as any).cookies,
        });
      },
      getSetting: async (key: string) => {
        const existing = await this.db.findOne(SystemTable.META, { key });
        return {
          found: !!existing,
          value: existing?.value ?? null,
          group: existing?.group || null,
        };
      },
      upsertSetting: async (key: string, value: string, group: string) => {
        const existing = await this.db.findOne(SystemTable.META, { key });
        if (existing) {
          await this.db.update(SystemTable.META, { key }, { value, group: existing.group || group });
          return;
        }
        await this.db.insert(SystemTable.META, { key, value, group });
      },
      resolveAdditionalTools: async ({ dryRun }) => {
        const frameworkTools = this.buildAssistantManagementTools();
        try {
          const payload = await this.manager.hooks.call('assistant:tools:extend', { dryRun, tools: [] as any[] });
          const extensionTools = Array.isArray((payload as any)?.tools) ? (payload as any).tools : [];
          return [...frameworkTools, ...extensionTools];
        } catch {
          return frameworkTools;
        }
      },
      resolveAdditionalPromptLines: async ({ collections, tools }) => {
        try {
          const payload = await this.manager.hooks.call('assistant:prompt:extend', {
            lines: [] as string[],
            collections,
            tools,
          });
          const lines = Array.isArray((payload as any)?.lines) ? (payload as any).lines : [];
          return lines.map((line: any) => String(line || '').trim()).filter(Boolean);
        } catch {
          return [];
        }
      },
      resolvePromptProfile: async ({ collections, plugins, tools }) => {
        const [basicStored, advancedStored] = await Promise.all([
          this.db.findOne(SystemTable.META, { key: ASSISTANT_PROMPT_BASIC_KEY }).catch(() => null),
          this.db.findOne(SystemTable.META, { key: ASSISTANT_PROMPT_ADVANCED_KEY }).catch(() => null),
        ]);

        const defaultProfile = {
          basicSystem: String(basicStored?.value || '').trim() || undefined,
          advancedSystem: String(advancedStored?.value || '').trim() || undefined,
        };

        try {
          const payload = await this.manager.hooks.call('assistant:prompt:profile', {
            ...defaultProfile,
            collections,
            plugins,
            tools,
          });

          return {
            basicSystem: String((payload as any)?.basicSystem || defaultProfile.basicSystem || '').trim() || undefined,
            advancedSystem: String((payload as any)?.advancedSystem || defaultProfile.advancedSystem || '').trim() || undefined,
          };
        } catch {
          return defaultProfile;
        }
      },
      resolveSkills: async () => {
        const defaults: ForgeSkillDefinition[] = [
          {
            id: 'general',
            label: 'General',
            description: 'Balanced assistant for chat and planning.',
            defaultMode: 'chat',
            riskPolicy: 'approval_required',
          },
          {
            id: 'editor',
            label: 'Content Editor',
            description: 'Focused editing for site copy and content collections.',
            defaultMode: 'plan',
            allowedTools: [
              'collections.list',
              'collections.resolve',
              'content.list',
              'content.resolve',
              'content.search_text',
              'content.update',
              'content.create',
              'plugins.settings.search_text',
              'themes.config.search_text',
              'system.now',
            ],
            riskPolicy: 'approval_required',
          },
          {
            id: 'ops',
            label: 'Ops Assistant',
            description: 'Plugin/theme/settings operations with approval-first safety.',
            defaultMode: 'plan',
            allowedTools: [
              'plugins.list',
              'plugins.settings.get',
              'plugins.settings.search_text',
              'plugins.settings.update',
              'themes.list',
              'themes.active',
              'themes.config.get',
              'themes.config.search_text',
              'themes.config.update',
              'settings.get',
              'settings.set',
              'system.now',
              'web.search',
              'web.fetch',
            ],
            riskPolicy: 'approval_required',
          },
          {
            id: 'research',
            label: 'Web Research',
            description: 'Browse the web and summarize external references.',
            defaultMode: 'chat',
            allowedTools: ['web.search', 'web.fetch', 'system.now'],
            riskPolicy: 'read_only',
            entryExamples: [
              'Find 3 competitor hero claims for contractor websites.',
              'Research current messaging trends for fast-loading agency sites.',
            ],
          },
          {
            id: 'page-audit',
            label: 'Page Auditor',
            description: 'Inspect live pages and map findings to content/theme/plugin sources.',
            defaultMode: 'plan',
            allowedTools: [
              'web.fetch',
              'web.search',
              'collections.list',
              'content.list',
              'content.resolve',
              'content.search_text',
              'plugins.settings.get',
              'plugins.settings.search_text',
              'themes.config.get',
              'themes.config.search_text',
              'system.now',
            ],
            riskPolicy: 'approval_required',
          },
        ];
        try {
          const payload = await this.manager.hooks.call('assistant:skills:extend', { skills: [] as ForgeSkillDefinition[] });
          const extensionSkills = Array.isArray((payload as any)?.skills) ? (payload as any).skills : [];
          return [...defaults, ...extensionSkills];
        } catch {
          return defaults;
        }
      },
    });
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
      const result = await runtime.chat({
        message,
        history,
        agentMode: String(normalizedBody?.agentMode || 'advanced'),
        maxIterations: Number(normalizedBody?.maxIterations || 8),
        maxDurationMs: Number(normalizedBody?.maxDurationMs || 35000),
        allowedTools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : [],
        skillId: String(normalizedBody?.skillId || '').trim() || undefined,
        sessionId: sessionId || undefined,
        continueFrom: parseBoolean(normalizedBody?.continueFrom) === true,
      } as any);

      const responsePayload = {
        ...result,
        provider: resolvedAssistant.provider,
        sessionId: sessionId || result.sessionId,
      } as any;

      if (sessionId) {
        const nextHistory = this.normalizeAssistantHistory([
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content: String(result?.message || '').trim() || 'No response generated.' },
        ]);
        await this.saveAssistantSession(sessionId, {
          id: sessionId,
          title: String(existingSession?.title || '').trim() || this.summarizeAssistantSessionTitle(nextHistory),
          updatedAt: Date.now(),
          provider: resolvedAssistant.provider,
          model: String(result?.model || '').trim() || String(existingSession?.model || '').trim() || '',
          agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim(),
          skillId: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general',
          tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [],
          sandboxMode: parseBoolean(normalizedBody?.dryRun) !== false,
          config: {
            ...(existingSession?.config && typeof existingSession.config === 'object' ? existingSession.config : {}),
            ...(normalizedBody?.config && typeof normalizedBody.config === 'object' ? normalizedBody.config : {}),
          },
          history: nextHistory,
          lastPlan: result?.plan || null,
          lastUi: result?.ui || null,
          lastActions: Array.isArray(result?.actions) ? result.actions : [],
          lastCheckpoint: result?.checkpoint || null,
        });
      }

      await this.emitAssistantTelemetry('chat.success', {
        provider: resolvedAssistant.provider,
        sessionId: sessionId || result?.sessionId || null,
        usedLegacyContract,
        agentMode: String(result?.agentMode || '').trim() || 'advanced',
        skillId: String(result?.skill?.id || normalizedBody?.skillId || '').trim() || 'general',
        iterations: Number(result?.iterations || 0) || 0,
        actions: Array.isArray(result?.actions) ? result.actions.length : 0,
        loopCapReached: result?.loopCapReached === true,
        durationMs: Date.now() - startedAt,
      });

      return res.json({
        ...responsePayload,
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
      const runtime = this.createAssistantRuntime(req);
      const result = await runtime.executeActions({
        actions: Array.isArray(normalizedBody?.actions) ? normalizedBody.actions : [],
        dryRun,
        context: {
          user: (req as any).user,
          headers: req.headers,
          cookies: (req as any).cookies,
        },
      });

      const sessionId = this.normalizeAssistantSessionId(normalizedBody?.sessionId);
      if (sessionId) {
        const existingSession = await this.loadAssistantSession(sessionId);
        if (existingSession) {
          await this.saveAssistantSession(sessionId, {
            ...existingSession,
            updatedAt: Date.now(),
            sandboxMode: dryRun,
            lastExecution: {
              dryRun,
              results: Array.isArray(result?.results) ? result.results : [],
            },
          });
        }
      }
      await this.emitAssistantTelemetry('actions.execute', {
        sessionId: sessionId || null,
        usedLegacyContract,
        dryRun,
        actions: Array.isArray(normalizedBody?.actions) ? normalizedBody.actions.length : 0,
        results: Array.isArray(result?.results) ? result.results.length : 0,
        ok: Array.isArray(result?.results) ? result.results.filter((item: any) => item?.ok).length : 0,
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

  async assistantPersonasLegacy(req: Request, res: Response) {
    this.setAssistantDeprecationHeaders(res, '/api/forge/admin/assistant/skills');
    try {
      const runtime = this.createAssistantRuntime(req);
      const skills = await runtime.listSkills();
      return res.json({
        personas: skills.map((skill) => ({
          id: skill.id,
          label: skill.label,
          description: skill.description,
          defaultMode: skill.defaultMode || 'chat',
          riskPolicy: skill.riskPolicy || 'approval_required',
        })),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant personas' });
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

      const message = String(req.body?.message || session?.lastCheckpoint?.resumePrompt || '').trim() ||
        'Continue planning from previous context. Run more steps and stage executable actions if safe.';
      const history = this.normalizeAssistantHistory(session?.history);

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
      const result = await runtime.chat({
        message,
        history,
        agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced'),
        maxIterations: Number(req.body?.maxIterations || 8),
        maxDurationMs: Number(req.body?.maxDurationMs || 35000),
        allowedTools: Array.isArray(req.body?.tools) ? req.body.tools : Array.isArray(session?.tools) ? session.tools : [],
        skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase(),
        sessionId,
        continueFrom: true,
      } as any);

      const nextHistory = this.normalizeAssistantHistory([
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: String(result?.message || '').trim() || 'No response generated.' },
      ]);

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
      });

      await this.emitAssistantTelemetry('chat.continue', {
        sessionId,
        provider: resolvedAssistant.provider,
        skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase() || 'general',
        iterations: Number(result?.iterations || 0) || 0,
        actions: Array.isArray(result?.actions) ? result.actions.length : 0,
        loopCapReached: result?.loopCapReached === true,
        durationMs: Date.now() - startedAt,
      });

      return res.json({
        ...result,
        provider: resolvedAssistant.provider,
        sessionId,
      });
    } catch (e: any) {
      await this.emitAssistantTelemetry('chat.continue.failed', {
        error: String(e?.message || 'Failed to continue assistant session'),
        durationMs: Date.now() - startedAt,
      });
      return res.status(500).json({ error: e?.message || 'Failed to continue assistant session' });
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
