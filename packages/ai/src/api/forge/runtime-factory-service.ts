import { Request } from 'express';
import {
  PluginManager,
  ThemeManager,
  SystemTable,
} from '@fromcode119/core';
import { ASSISTANT_PROMPT_COPY } from '../../assistant-copy';
import {
  AdminAssistantRuntime,
} from '@fromcode119/ai/runtime';
import { IDatabaseManager } from '@fromcode119/database';
import { AssistantManagementToolsService } from './management-tools-service';
import { AssistantCatalogService } from './catalog-service';

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

    const resolveAssistantContentItem = async (collection: any, selector: any) => {
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
          new Set([primaryKey, 'id', '_id', 'uuid'].filter((field) => fieldNames.includes(field))),
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
      getCollections: () => this.catalog.getCollectionsContext(),
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
      resolvePromptProfile: async ({ collections, plugins, tools }) => {
        const [basicStored, advancedStored] = await Promise.all([
          this.db.findOne(SystemTable.META, { key: this.promptKeys.basic }).catch(() => null),
          this.db.findOne(SystemTable.META, { key: this.promptKeys.advanced }).catch(() => null),
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
          basic: [...ASSISTANT_PROMPT_COPY.basic],
          advanced: [...ASSISTANT_PROMPT_COPY.advanced],
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
    });
  }
}
