import { TypeUtils, PluginManager } from '@fromcode119/core';
import type { McpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from './helpers';

const DEFAULT_MAX_SCANNED_FILES = 2000;
const DEFAULT_SEARCH_MATCH_LIMIT = 80;

export class PluginTools {
  static buildPluginManagementTools(input: { manager: PluginManager; helpers: AssistantToolingHelpers }): McpToolDefinition[] {
    const { manager, helpers } = input;

  const pluginSummary = () =>
    manager.getSortedPlugins(manager.getPlugins()).map((plugin: any) => ({
      slug: String(plugin?.manifest?.slug || '').trim(),
      name: String(plugin?.manifest?.name || plugin?.manifest?.slug || '').trim(),
      version: String(plugin?.manifest?.version || '').trim(),
      state: String(plugin?.state || 'unknown').trim(),
      capabilities: Array.isArray(plugin?.manifest?.capabilities) ? plugin.manifest.capabilities : [],
    }));

  return [
    {
      tool: 'plugins.marketplace.list',
      readOnly: true,
      description: 'List plugins available from marketplace.',
      handler: async () => {
        const catalog = await manager.marketplace.fetchCatalog();
        return {
          plugins: Array.isArray(catalog) ? catalog : [],
        };
      },
    },
    {
      tool: 'plugins.install',
      readOnly: false,
      description: 'Install plugin from marketplace by slug and optionally enable it.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing plugin slug');
        const activate = TypeUtils.parseBoolean(input?.activate) !== false;
        const effectiveDryRun = context?.dryRun === true;

        if (effectiveDryRun) {
          return { dryRun: true, operation: 'plugins.install', slug, activate };
        }

        const manifest = await manager.installOrUpdateFromMarketplace(slug);
        let enabled = false;
        let enableError: string | null = null;
        if (activate) {
          try {
            await manager.enable(slug);
            enabled = true;
          } catch (error: any) {
            enableError = String(error?.message || 'Enable failed');
          }
        }

        return {
          dryRun: false,
          operation: 'plugins.install',
          slug,
          enabled,
          enableError,
          manifest,
        };
      },
    },
    {
      tool: 'plugins.update',
      readOnly: false,
      description: 'Update plugin from marketplace by slug.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing plugin slug');
        if (context?.dryRun === true) {
          return { dryRun: true, operation: 'plugins.update', slug };
        }
        const manifest = await manager.installOrUpdateFromMarketplace(slug);
        return { dryRun: false, operation: 'plugins.update', slug, manifest };
      },
    },
    {
      tool: 'plugins.enable',
      readOnly: false,
      description: 'Enable installed plugin.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing plugin slug');
        if (context?.dryRun === true) {
          return { dryRun: true, operation: 'plugins.enable', slug };
        }
        await manager.enable(slug, {
          force: TypeUtils.parseBoolean(input?.force),
          recursive: TypeUtils.parseBoolean(input?.recursive) !== false,
        });
        return { dryRun: false, operation: 'plugins.enable', slug };
      },
    },
    {
      tool: 'plugins.disable',
      readOnly: false,
      description: 'Disable installed plugin.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing plugin slug');
        if (context?.dryRun === true) {
          return { dryRun: true, operation: 'plugins.disable', slug };
        }
        await manager.disable(slug);
        return { dryRun: false, operation: 'plugins.disable', slug };
      },
    },
    {
      tool: 'plugins.settings.get',
      readOnly: true,
      description: 'Get plugin configuration/settings by slug.',
      handler: async (input) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing plugin slug');
        const config = helpers.readPluginConfig(slug);
        const schema = manager.getPluginSettings(slug);
        return {
          slug,
          config,
          schema: schema && typeof schema === 'object' ? schema : null,
        };
      },
    },
    {
      tool: 'plugins.settings.search_text',
      readOnly: true,
      description: 'Search text across plugin configuration objects.',
      handler: async (input) => {
        const query = String(input?.query || input?.text || '').trim();
        if (!query) throw new Error('Missing search query');
        const queryLower = helpers.normalizeSearchText(query);
        const queryTokens = helpers.tokenizeSearchQuery(query);
        const requestedSlug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const maxMatches = Math.min(200, Math.max(1, Number(input?.maxMatches || 40)));

        const pluginSlugs = requestedSlug
          ? [requestedSlug]
          : manager
              .getSortedPlugins(manager.getPlugins())
              .map((plugin: any) => helpers.toAssistantSlug(String(plugin?.manifest?.slug || ''), ''))
              .filter(Boolean);

        const matches: Array<{ slug: string; path: string; value: string }> = [];
        for (const slug of pluginSlugs) {
          if (matches.length >= maxMatches) break;
          const config = helpers.readPluginConfig(slug);
          const found = helpers.collectObjectStringMatches(config, queryLower, queryTokens, 'config');
          for (const item of found) {
            if (matches.length >= maxMatches) break;
            matches.push({
              slug,
              path: item.path,
              value: item.value.length > 240 ? `${item.value.slice(0, 240)}...` : item.value,
            });
          }
        }

        return {
          query,
          matches,
          totalMatches: matches.length,
          truncated: matches.length >= maxMatches,
        };
      },
    },
    {
      tool: 'plugins.files.search_text',
      readOnly: true,
      description: 'Search text across plugin source files.',
      handler: async (input) => {
        const query = String(input?.query || input?.text || '').trim();
        if (!query) throw new Error('Missing search query');
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const maxMatches = Math.min(400, Math.max(1, Number(input?.maxMatches || DEFAULT_SEARCH_MATCH_LIMIT)));
        const maxFiles = Math.min(5000, Math.max(1, Number(input?.maxFiles || DEFAULT_MAX_SCANNED_FILES)));
        const results = helpers.searchScopeFiles({
          scope: 'plugins',
          query,
          slug,
          maxMatches,
          maxFiles,
        });
        return {
          query,
          slug: slug || null,
          matches: results.matches,
          totalMatches: results.totalMatches,
          scannedFiles: results.scannedFiles,
          truncated: results.truncated,
        };
      },
    },
    {
      tool: 'plugins.files.replace_text',
      readOnly: false,
      description: 'Replace exact text inside one plugin source file.',
      handler: async (input, context) => {
        const from = String(input?.from || input?.query || input?.search || '').trim();
        const to = String(input?.to || input?.replaceWith || input?.value || '');
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const filePathInput = String(input?.path || input?.filePath || input?.file || '').trim();
        if (!from) throw new Error('Missing source text (from)');
        if (!to) throw new Error('Missing replacement text (to)');
        if (!slug && !filePathInput) throw new Error('Missing plugin slug or file path');

        const caseSensitive = TypeUtils.parseBoolean(input?.caseSensitive) === true;
        const resolvedPath = helpers.resolveScopedFilePath('plugins', slug, filePathInput);
        const replacement = helpers.replaceTextInFile({
          filePath: resolvedPath,
          from,
          to,
          caseSensitive,
          dryRun: context?.dryRun === true,
        });
        return {
          operation: 'plugins.files.replace_text',
          dryRun: context?.dryRun === true,
          slug: slug || helpers.scopeSlugFromPath('plugins', resolvedPath),
          ...replacement,
        };
      },
    },
    {
      tool: 'plugins.settings.update',
      readOnly: false,
      description: 'Update plugin configuration/settings by slug.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing plugin slug');
        const patch = input?.config && typeof input.config === 'object'
          ? input.config
          : input?.data && typeof input.data === 'object'
            ? input.data
            : {};
        const merge = input?.merge !== false;
        const current = helpers.readPluginConfig(slug);
        const nextConfig = merge ? { ...current, ...patch } : patch;

        if (context?.dryRun === true) {
          return {
            dryRun: true,
            operation: 'plugins.settings.update',
            slug,
            merge,
            nextConfig,
          };
        }

        await manager.savePluginConfig(slug, nextConfig);
        return {
          dryRun: false,
          operation: 'plugins.settings.update',
          slug,
          config: nextConfig,
        };
      },
    },
    {
      tool: 'plugins.create.scaffold',
      readOnly: false,
      description: 'Create a new plugin scaffold on disk and optionally enable it.',
      handler: async (input, context) => {
        if (context?.dryRun === true) {
          return {
            dryRun: true,
            operation: 'plugins.create.scaffold',
            slug: helpers.toAssistantSlug(String(input?.slug || input?.name || ''), 'plugin'),
            name: helpers.toAssistantTitle(String(input?.name || ''), 'plugin'),
            activate: TypeUtils.parseBoolean(input?.activate) !== false,
          };
        }
        const created = await manager.scaffoldPlugin({
          slug: helpers.toAssistantSlug(String(input?.slug || input?.name || ''), 'plugin'),
          name: helpers.toAssistantTitle(String(input?.name || ''), 'plugin'),
          description: String(input?.description || '').trim(),
          version: String(input?.version || '1.0.0').trim() || '1.0.0',
          activate: TypeUtils.parseBoolean(input?.activate) !== false,
        });
        return {
          dryRun: false,
          operation: 'plugins.create.scaffold',
          ...created,
          plugins: pluginSummary(),
        };
      },
    },
  ];
  }
}