import { ExtensionArea } from '@ai/api/forge/enums/extension-area.enum';
import { TypeUtils, PluginManager } from '@fromcode119/core';
import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';

/**
 * The plugin tools that only LOOK: listing what is installed, reading settings, searching files.
 *
 * Separated from the mutating ones because the separation is the permission boundary. Everything
 * here is `system:view` and marked `readOnly`, which is what lets an assistant session be granted
 * inspection without being granted the ability to install or disable anything.
 */
export class PluginReadTools {
  /** Caps on a file search, so an assistant cannot walk an entire installation by accident. */
  private static readonly DEFAULT_MAX_SCANNED_FILES = 2000;
  private static readonly DEFAULT_SEARCH_MATCH_LIMIT = 80;

  static build(input: { manager: PluginManager; helpers: AssistantToolingHelpers }): IMcpToolDefinition[] {
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
      permission: 'system:view',
      inputSchema: McpSchema.object({}),
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
      tool: 'plugins.settings.get',
      permission: 'system:view',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
          }, ['slug']),
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
      permission: 'system:view',
      inputSchema: McpSchema.object({
            query: McpSchema.string({ description: 'Text to find.' }),
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            maxMatches: McpSchema.number({ description: 'Matches to return, 1-200. Defaults to 40.' }),
          }, ['query']),
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
      permission: 'system:view',
      inputSchema: McpSchema.object({
            query: McpSchema.string({ description: 'Text to find.' }),
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            maxMatches: McpSchema.number({ description: 'Matches to return, 1-400.' }),
            maxFiles: McpSchema.number({ description: 'Files to scan, 1-5000.' }),
          }, ['query']),
      readOnly: true,
      description: 'Search text across plugin source files.',
      handler: async (input) => {
        const query = String(input?.query || input?.text || '').trim();
        if (!query) throw new Error('Missing search query');
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const maxMatches = Math.min(400, Math.max(1, Number(input?.maxMatches || PluginReadTools.DEFAULT_SEARCH_MATCH_LIMIT)));
        const maxFiles = Math.min(5000, Math.max(1, Number(input?.maxFiles || PluginReadTools.DEFAULT_MAX_SCANNED_FILES)));
        const results = helpers.searchScopeFiles({
          scope: ExtensionArea.PLUGINS,
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
    ];
  }
}
