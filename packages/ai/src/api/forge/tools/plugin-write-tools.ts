import { ExtensionArea } from '@ai/api/forge/enums/extension-area.enum';
import { TypeUtils, PluginManager } from '@fromcode119/core';
import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';

/**
 * The plugin tools that CHANGE something: install, update, enable, disable, edit settings or files.
 *
 * All `system:manage`. Kept apart from the read tools so the two sets can be granted separately —
 * see `PluginReadTools` for the other half.
 */
export class PluginWriteTools {
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
      tool: 'plugins.install',
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            activate: McpSchema.boolean({ description: 'Activate after the operation. Defaults to true.' }),
          }, ['slug']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
          }, ['slug']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            force: McpSchema.boolean({ description: 'Enable despite warnings.' }),
            recursive: McpSchema.boolean({ description: 'Also enable dependencies. Defaults to true.' }),
          }, ['slug']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
          }, ['slug']),
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
      tool: 'plugins.files.replace_text',
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            from: McpSchema.string({ description: 'Exact text to find.' }),
            to: McpSchema.string({ description: 'Replacement text.' }),
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            path: McpSchema.string({ description: 'File path within the plugin/theme.' }),
            caseSensitive: McpSchema.boolean({ description: 'Match case exactly. Defaults to false.' }),
          }, ['from', 'to']),
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
        const resolvedPath = helpers.resolveScopedFilePath(ExtensionArea.PLUGINS, slug, filePathInput);
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
          slug: slug || helpers.scopeSlugFromPath(ExtensionArea.PLUGINS, resolvedPath),
          ...replacement,
        };
      },
    },
    {
      tool: 'plugins.settings.update',
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            config: McpSchema.object({}),
            merge: McpSchema.boolean({ description: 'Merge into existing config. Defaults to true.' }),
          }, ['slug', 'config']),
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
      permission: 'system:manage',
      inputSchema: McpSchema.object({
            slug: McpSchema.string({ description: 'Plugin/theme slug.' }),
            name: McpSchema.string({ description: 'Human-readable name.' }),
            description: McpSchema.string({ description: 'Short description.' }),
            version: McpSchema.string({ description: 'Semver, e.g. "1.0.0". Defaults to 1.0.0.' }),
            activate: McpSchema.boolean({ description: 'Activate after the operation. Defaults to true.' }),
          }, ['name']),
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
