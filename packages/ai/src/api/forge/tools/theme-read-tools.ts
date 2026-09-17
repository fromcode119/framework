import { ExtensionArea } from '@ai/api/forge/enums/extension-area.enum';
import { TypeUtils, ThemeManager } from '@fromcode119/core';
import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';

/**
 * The theme tools that only LOOK: what is installed, what the marketplace offers, what a theme's
 * config and files contain.
 *
 * All `system:view` and marked `readOnly`, which is the point of the split — a session can be given
 * theme inspection without being given the ability to install, activate or edit one.
 */
export class ThemeReadTools {
  /** Caps on a file search, so an assistant cannot walk an entire theme tree by accident. */
  private static readonly DEFAULT_MAX_SCANNED_FILES = 2000;
  private static readonly DEFAULT_SEARCH_MATCH_LIMIT = 80;

  static build(input: { themeManager: ThemeManager; helpers: AssistantToolingHelpers }): IMcpToolDefinition[] {
    const { themeManager, helpers } = input;
    const themeSummary = () => themeManager.getThemes().map((theme: any) => ({
      slug: String(theme?.slug || '').trim(),
      name: String(theme?.name || theme?.slug || '').trim(),
      version: String(theme?.version || '').trim(),
      state: String(theme?.state || 'inactive').trim(),
    }));
    return [
    {
      tool: 'themes.list',
      permission: 'system:view',
      inputSchema: McpSchema.object({}),
      readOnly: true,
      description: 'List installed themes and active state.',
      handler: async () => ({
        themes: themeSummary(),
      }),
    },
    {
      tool: 'themes.marketplace.list',
      permission: 'system:view',
      inputSchema: McpSchema.object({}),
      readOnly: true,
      description: 'List themes available from marketplace.',
      handler: async () => {
        const themes = await themeManager.getMarketplaceThemes();
        return {
          themes: Array.isArray(themes) ? themes : [],
        };
      },
    },
    {
      tool: 'themes.config.get',
      permission: 'system:view',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
          }, ['slug']),
      readOnly: true,
      description: 'Get theme configuration by slug.',
      handler: async (input) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing theme slug');
        const config = await themeManager.getThemeConfig(slug);
        return {
          slug,
          config: config && typeof config === 'object' ? config : {},
        };
      },
    },
    {
      tool: 'themes.config.search_text',
      permission: 'system:view',
      inputSchema: McpSchema.object({
            query: McpSchema.string({ description: 'Text to find.' }),
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            maxMatches: McpSchema.number({ description: 'Matches to return, 1-200. Defaults to 40.' }),
          }, ['query']),
      readOnly: true,
      description: 'Search text across theme configuration objects.',
      handler: async (input) => {
        const query = String(input?.query || input?.text || '').trim();
        if (!query) throw new Error('Missing search query');
        const queryLower = helpers.normalizeSearchText(query);
        const queryTokens = helpers.tokenizeSearchQuery(query);
        const requestedSlug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const maxMatches = Math.min(200, Math.max(1, Number(input?.maxMatches || 40)));

        const themeSlugs = requestedSlug
          ? [requestedSlug]
          : themeManager
              .getThemes()
              .map((theme: any) => helpers.toAssistantSlug(String(theme?.slug || ''), ''))
              .filter(Boolean);

        const matches: Array<{ slug: string; path: string; value: string }> = [];
        for (const slug of themeSlugs) {
          if (matches.length >= maxMatches) break;
          const config = await themeManager.getThemeConfig(slug);
          const safeConfig = config && typeof config === 'object' ? config : {};
          const found = helpers.collectObjectStringMatches(safeConfig, queryLower, queryTokens, 'config');
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
      tool: 'themes.files.search_text',
      permission: 'system:view',
      inputSchema: McpSchema.object({
            query: McpSchema.string({ description: 'Text to find.' }),
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            maxMatches: McpSchema.number({ description: 'Matches to return, 1-400.' }),
            maxFiles: McpSchema.number({ description: 'Files to scan, 1-5000.' }),
          }, ['query']),
      readOnly: true,
      description: 'Search text across theme source files.',
      handler: async (input) => {
        const query = String(input?.query || input?.text || '').trim();
        if (!query) throw new Error('Missing search query');
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const maxMatches = Math.min(400, Math.max(1, Number(input?.maxMatches || ThemeReadTools.DEFAULT_SEARCH_MATCH_LIMIT)));
        const maxFiles = Math.min(5000, Math.max(1, Number(input?.maxFiles || ThemeReadTools.DEFAULT_MAX_SCANNED_FILES)));
        const results = helpers.searchScopeFiles({
          scope: ExtensionArea.THEMES,
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
