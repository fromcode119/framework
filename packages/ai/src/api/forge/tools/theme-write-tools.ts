import { ExtensionArea } from '@ai/api/forge/enums/extension-area.enum';
import { TypeUtils, ThemeManager } from '@fromcode119/core';
import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';

/**
 * The theme tools that CHANGE something: install, update, activate, edit config or files, scaffold.
 *
 * All `system:manage`. Activating a theme changes what every visitor to the site sees, which is why
 * it is on this side of the line rather than filed with the listing it sits next to in the UI.
 */
export class ThemeWriteTools {
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
      tool: 'themes.install',
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            version: McpSchema.string({ description: 'Version to install. Omit for latest.' }),
            activate: McpSchema.boolean({ description: 'Activate after the operation. Defaults to true.' }),
          }, ['slug']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
          }, ['slug']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
          }, ['slug']),
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
      tool: 'themes.files.replace_text',
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            from: McpSchema.string({ description: 'Exact text to find.' }),
            to: McpSchema.string({ description: 'Replacement text.' }),
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            path: McpSchema.string({ description: 'File path within the plugin/theme.' }),
            caseSensitive: McpSchema.boolean({ description: 'Match case exactly. Defaults to false.' }),
          }, ['from', 'to']),
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
        const resolvedPath = helpers.resolveScopedFilePath(ExtensionArea.THEMES, slug, filePathInput);
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
          slug: slug || helpers.scopeSlugFromPath(ExtensionArea.THEMES, resolvedPath),
          ...replacement,
        };
      },
    },
    {
      tool: 'themes.config.update',
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            config: McpSchema.object({}),
            merge: McpSchema.boolean({ description: 'Merge into existing config. Defaults to true.' }),
          }, ['slug', 'config']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            name: McpSchema.string({ description: 'Human-readable name.' }),
            description: McpSchema.string({ description: 'Short description.' }),
            version: McpSchema.string({ description: 'Semver, e.g. "1.0.0". Defaults to 1.0.0.' }),
            activate: McpSchema.boolean({ description: 'Activate after the operation. Defaults to true.' }),
          }, ['name']),
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
    },
    ];
  }
}
