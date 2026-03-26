import { TypeUtils, ThemeManager } from '@fromcode119/core';
import type { McpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from './helpers';

const DEFAULT_MAX_SCANNED_FILES = 2000, DEFAULT_SEARCH_MATCH_LIMIT = 80;

export class ThemeTools {
  static buildThemeManagementTools(input: { themeManager: ThemeManager; helpers: AssistantToolingHelpers }): McpToolDefinition[] {
    const { themeManager, helpers } = input;
    const themeSummary = () => themeManager.getThemes().map((theme: any) => ({
      slug: String(theme?.slug || '').trim(),
      name: String(theme?.name || theme?.slug || '').trim(),
      version: String(theme?.version || '').trim(),
      state: String(theme?.state || 'inactive').trim(),
    }));
    return [{
      tool: 'themes.list',
      readOnly: true,
      description: 'List installed themes and active state.',
      handler: async () => ({
        themes: themeSummary(),
      }),
    },
    {
      tool: 'themes.marketplace.list',
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
      tool: 'themes.install',
      readOnly: false,
      description: 'Install theme from marketplace by slug and optionally activate it.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const version = String(input?.version || '').trim();
        if (!slug) throw new Error('Missing theme slug');
        const activate = TypeUtils.parseBoolean(input?.activate) !== false;
        if (context?.dryRun === true) {
          return { dryRun: true, operation: 'themes.install', slug, version: version || null, activate };
        }

        const themes = await themeManager.getMarketplaceThemes();
        const pkg = themes.find((entry: any) => {
          const entrySlug = helpers.toAssistantSlug(String(entry?.slug || ''), '');
          if (entrySlug !== slug) return false;
          if (!version) return true;
          return String(entry?.version || '').trim() === version;
        });
        if (!pkg) {
          throw new Error(`Theme "${slug}"${version ? ` (${version})` : ''} not found in marketplace.`);
        }

        await themeManager.installTheme(pkg);
        let activated = false;
        let activationError: string | null = null;
        if (activate) {
          try {
            await themeManager.activateTheme(slug);
            activated = true;
          } catch (error: any) {
            activationError = String(error?.message || 'Theme activation failed');
          }
        }

        return {
          dryRun: false,
          operation: 'themes.install',
          slug,
          version: String(pkg?.version || '').trim() || null,
          activated,
          activationError,
          themes: themeSummary(),
        };
      },
    },
    {
      tool: 'themes.update',
      readOnly: false,
      description: 'Update installed theme from marketplace by slug.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing theme slug');
        if (context?.dryRun === true) {
          return { dryRun: true, operation: 'themes.update', slug };
        }

        const themes = await themeManager.getMarketplaceThemes();
        const pkg = themes.find((entry: any) => helpers.toAssistantSlug(String(entry?.slug || ''), '') === slug);
        if (!pkg) throw new Error(`Theme "${slug}" not found in marketplace.`);
        await themeManager.installTheme(pkg);
        return {
          dryRun: false,
          operation: 'themes.update',
          slug,
          version: String(pkg?.version || '').trim() || null,
          themes: themeSummary(),
        };
      },
    },
    {
      tool: 'themes.activate',
      readOnly: false,
      description: 'Activate installed theme by slug.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing theme slug');
        if (context?.dryRun === true) {
          return { dryRun: true, operation: 'themes.activate', slug };
        }
        await themeManager.activateTheme(slug);
        return { dryRun: false, operation: 'themes.activate', slug, themes: themeSummary() };
      },
    },
    {
      tool: 'themes.config.get',
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
      readOnly: true,
      description: 'Search text across theme source files.',
      handler: async (input) => {
        const query = String(input?.query || input?.text || '').trim();
        if (!query) throw new Error('Missing search query');
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const maxMatches = Math.min(400, Math.max(1, Number(input?.maxMatches || DEFAULT_SEARCH_MATCH_LIMIT)));
        const maxFiles = Math.min(5000, Math.max(1, Number(input?.maxFiles || DEFAULT_MAX_SCANNED_FILES)));
        const results = helpers.searchScopeFiles({
          scope: 'themes',
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
      tool: 'themes.files.replace_text',
      readOnly: false,
      description: 'Replace exact text inside one theme source file.',
      handler: async (input, context) => {
        const from = String(input?.from || input?.query || input?.search || '').trim();
        const to = String(input?.to || input?.replaceWith || input?.value || '');
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        const filePathInput = String(input?.path || input?.filePath || input?.file || '').trim();
        if (!from) throw new Error('Missing source text (from)');
        if (!to) throw new Error('Missing replacement text (to)');
        if (!slug && !filePathInput) throw new Error('Missing theme slug or file path');

        const caseSensitive = TypeUtils.parseBoolean(input?.caseSensitive) === true;
        const resolvedPath = helpers.resolveScopedFilePath('themes', slug, filePathInput);
        const replacement = helpers.replaceTextInFile({
          filePath: resolvedPath,
          from,
          to,
          caseSensitive,
          dryRun: context?.dryRun === true,
        });
        return {
          operation: 'themes.files.replace_text',
          dryRun: context?.dryRun === true,
          slug: slug || helpers.scopeSlugFromPath('themes', resolvedPath),
          ...replacement,
        };
      },
    },
    {
      tool: 'themes.config.update',
      readOnly: false,
      description: 'Update theme configuration by slug.',
      handler: async (input, context) => {
        const slug = helpers.toAssistantSlug(String(input?.slug || ''), '');
        if (!slug) throw new Error('Missing theme slug');
        const patch = input?.config && typeof input.config === 'object'
          ? input.config
          : input?.data && typeof input.data === 'object'
            ? input.data
            : {};
        const merge = input?.merge !== false;
        const currentConfig = await themeManager.getThemeConfig(slug);
        const nextConfig = merge ? { ...(currentConfig || {}), ...patch } : patch;

        if (context?.dryRun === true) {
          return {
            dryRun: true,
            operation: 'themes.config.update',
            slug,
            merge,
            nextConfig,
          };
        }

        await themeManager.saveThemeConfig(slug, nextConfig);
        return {
          dryRun: false,
          operation: 'themes.config.update',
          slug,
          config: nextConfig,
        };
      },
    },
    {
      tool: 'themes.create.scaffold',
      readOnly: false,
      description: 'Create a new theme scaffold on disk and optionally activate it.',
      handler: async (input, context) => {
        if (context?.dryRun === true) {
          return {
            dryRun: true,
            operation: 'themes.create.scaffold',
            slug: helpers.toAssistantSlug(String(input?.slug || input?.name || ''), 'theme'),
            name: helpers.toAssistantTitle(String(input?.name || ''), 'theme'),
            activate: TypeUtils.parseBoolean(input?.activate) !== false,
          };
        }
        const created = await themeManager.scaffoldTheme({
          slug: helpers.toAssistantSlug(String(input?.slug || input?.name || ''), 'theme'),
          name: helpers.toAssistantTitle(String(input?.name || ''), 'theme'),
          description: String(input?.description || '').trim(),
          version: String(input?.version || '1.0.0').trim() || '1.0.0',
          activate: TypeUtils.parseBoolean(input?.activate) !== false,
        });
        return {
          dryRun: false,
          operation: 'themes.create.scaffold',
          ...created,
          themes: themeSummary(),
        };
      },
    }];
  }
}
