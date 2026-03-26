import { Request } from 'express';
import path from 'path';
import {
  PluginManager,
  ThemeManager,
} from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core/client';
import { AssistantCopyUtils } from '../../assistant-copy';
import {
  AdminAssistantRuntimeEngine,
} from '../../admin-assistant-runtime-engine';
import { IDatabaseManager } from '@fromcode119/database';
import { AssistantManagementToolsService } from './management-tools-service';
import { AssistantCatalogService } from './catalog-service';
import { AssistantRuntimeContentResolver } from './runtime-content-resolver';

export class AssistantRuntimeFactoryService {
  constructor(
    private manager: PluginManager,
    private themeManager: ThemeManager,
    private restController: any,
    private db: IDatabaseManager,
    private managementTools: AssistantManagementToolsService,
    private catalog: AssistantCatalogService,
    private promptKeys: { basic: string; advanced: string },
  ) {}

  createAssistantRuntime(req: Request, aiClient?: any) {
    const user = (req as any).user;
    const frameworkRoot = process.cwd();
    const themesRoot = String((this.themeManager as any)?.themesRoot || '').trim() || path.join(frameworkRoot, 'themes');
    const contentResolver = new AssistantRuntimeContentResolver(
      this.restController,
      user,
      req.headers,
      (req as any).cookies,
    );

    const runtimeOptions = {
      aiClient: aiClient || null,
      getCollections: () => this.catalog.getCollectionsContext(),
      getPlugins: () => this.manager.getSortedPlugins(this.manager.getPlugins()).map((plugin: any) => ({
        slug: String(plugin?.manifest?.slug || '').trim(),
        name: String(plugin?.manifest?.name || plugin?.manifest?.slug || '').trim(),
        version: String(plugin?.manifest?.version || '0').trim(),
        state: String(plugin?.state || 'unknown').trim(),
        capabilities: Array.isArray(plugin?.manifest?.capabilities) ? plugin.manifest.capabilities : [],
        path: String(plugin?.path || '').trim() || undefined,
      })),
      getThemes: () => this.themeManager.getThemes().map((theme: any) => ({
        slug: String(theme?.slug || '').trim(),
        name: String(theme?.name || theme?.slug || '').trim(),
        version: String(theme?.version || '').trim(),
        state: String(theme?.state || 'inactive').trim(),
        path: String(theme?.path || '').trim() || path.join(themesRoot, String(theme?.slug || '').trim()),
      })),
      findCollectionBySlug: (source: string) => this.catalog.findCollectionBySlug(source),
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
        return contentResolver.resolveContentItem(collection, selector || {});
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

        const existing = await contentResolver.resolveContentItem(collection, {
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
        const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
        return {
          found: !!existing,
          value: existing?.value ?? null,
          group: existing?.group || null,
        };
      },
      upsertSetting: async (key: string, value: string, group: string) => {
        const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
        if (existing) {
          await this.db.update(SystemConstants.TABLE.META, { key }, { value, group: existing.group || group });
          return;
        }
        await this.db.insert(SystemConstants.TABLE.META, { key, value, group });
      },
      resolveAdditionalTools: async ({ dryRun }) => {
        const frameworkTools = this.managementTools.buildTools();
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
      resolveWorkspaceMap: async ({ collections, plugins, themes, tools }) => {
        const activeTheme = (Array.isArray(themes) ? themes : []).find(
          (theme: any) => String(theme?.state || '').toLowerCase() === 'active',
        ) || null;
        return {
          generatedAt: Date.now(),
          frameworkRoot,
          activeThemeSlug: activeTheme ? String(activeTheme.slug || '').trim() : undefined,
          plugins: (Array.isArray(plugins) ? plugins : []).map((plugin: any) => ({
            slug: String(plugin?.slug || '').trim(),
            name: String(plugin?.name || plugin?.slug || '').trim(),
            version: String(plugin?.version || '').trim() || undefined,
            state: String(plugin?.state || '').trim() || undefined,
            capabilities: Array.isArray(plugin?.capabilities)
              ? plugin.capabilities.map((cap: any) => String(cap || '').trim()).filter(Boolean)
              : undefined,
            path: String(plugin?.path || '').trim() || undefined,
          })),
          themes: (Array.isArray(themes) ? themes : []).map((theme: any) => ({
            slug: String(theme?.slug || '').trim(),
            name: String(theme?.name || theme?.slug || '').trim(),
            version: String(theme?.version || '').trim() || undefined,
            state: String(theme?.state || '').trim() || undefined,
            path: String(theme?.path || '').trim() || path.join(themesRoot, String(theme?.slug || '').trim()),
          })),
          collections: (Array.isArray(collections) ? collections : []).map((collection: any) => ({
            slug: String(collection?.slug || '').trim(),
            shortSlug: String(collection?.shortSlug || collection?.slug || '').trim(),
            label: String(collection?.label || collection?.slug || '').trim(),
            pluginSlug: String(collection?.pluginSlug || 'system').trim(),
            fieldNames: Array.isArray(collection?.raw?.fields)
              ? collection.raw.fields.map((field: any) => String(field?.name || '').trim()).filter(Boolean).slice(0, 50)
              : undefined,
          })),
          tools: (Array.isArray(tools) ? tools : [])
            .map((tool: any) => ({
              tool: String(tool?.tool || '').trim(),
              readOnly: tool?.readOnly === true,
            }))
            .filter((tool: any) => !!tool.tool),
        };
      },
      resolvePromptProfile: async ({ collections, plugins, tools }) => {
        const [basicStored, advancedStored] = await Promise.all([
          this.db.findOne(SystemConstants.TABLE.META, { key: this.promptKeys.basic }).catch(() => null),
          this.db.findOne(SystemConstants.TABLE.META, { key: this.promptKeys.advanced }).catch(() => null),
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
      resolvePromptCopy: async ({ collections, plugins, tools }) => {
        const defaultCopy = {
          basic: [...AssistantCopyUtils.PROMPT_COPY.basic],
          advanced: [...AssistantCopyUtils.PROMPT_COPY.advanced],
        };
        try {
          const payload = await this.manager.hooks.call('assistant:prompt:copy', {
            ...defaultCopy,
            collections,
            plugins,
            tools,
          });
          const basic = Array.isArray((payload as any)?.basic)
            ? (payload as any).basic.map((line: any) => String(line || '').trim()).filter(Boolean)
            : defaultCopy.basic;
          const advanced = Array.isArray((payload as any)?.advanced)
            ? (payload as any).advanced.map((line: any) => String(line || '').trim()).filter(Boolean)
            : defaultCopy.advanced;
          return { basic, advanced };
        } catch {
          return defaultCopy;
        }
      },
      resolveSkills: async () => {
        try {
          const payload = await this.manager.hooks.call('assistant:skills:extend', { skills: [] as any[] });
          const extensionSkills = Array.isArray((payload as any)?.skills) ? (payload as any).skills : [];
          return extensionSkills;
        } catch {
          return [];
        }
      },
    };

    return new AdminAssistantRuntimeEngine(runtimeOptions);
  }
}
