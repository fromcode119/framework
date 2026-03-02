import {
  BackupService,
  getPluginsDir,
  getProjectRoot,
  getThemesDir,
  parseBoolean,
  PluginManager,
  ThemeManager,
} from '@fromcode119/core';
import type { McpToolDefinition } from '@fromcode119/mcp';
import * as fs from 'fs';
import * as path from 'path';

export class ForgeManagementToolsService {
  constructor(private manager: PluginManager, private themeManager: ThemeManager) {}

  public normalizeSearchText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public buildTools(): McpToolDefinition[] {
    const pluginSummary = () =>
      this.manager.getSortedPlugins(this.manager.getPlugins()).map((plugin: any) => ({
        slug: String(plugin?.manifest?.slug || '').trim(),
        name: String(plugin?.manifest?.name || plugin?.manifest?.slug || '').trim(),
        version: String(plugin?.manifest?.version || '').trim(),
        state: String(plugin?.state || 'unknown').trim(),
        capabilities: Array.isArray(plugin?.manifest?.capabilities) ? plugin.manifest.capabilities : [],
      }));

    const themeSummary = () =>
      this.themeManager.getThemes().map((theme: any) => ({
        slug: String(theme?.slug || '').trim(),
        name: String(theme?.name || theme?.slug || '').trim(),
        version: String(theme?.version || '').trim(),
        state: String(theme?.state || 'inactive').trim(),
      }));

    return [
      {
        tool: 'plugins.marketplace.list',
        readOnly: true,
        description: 'List plugins available from marketplace.',
        handler: async () => {
          const catalog = await this.manager.marketplace.fetchCatalog();
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
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing plugin slug');
          const activate = parseBoolean(input?.activate) !== false;
          const effectiveDryRun = context?.dryRun === true;

          if (effectiveDryRun) {
            return { dryRun: true, operation: 'plugins.install', slug, activate };
          }

          const manifest = await this.manager.installOrUpdateFromMarketplace(slug);
          let enabled = false;
          let enableError: string | null = null;
          if (activate) {
            try {
              await this.manager.enable(slug);
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
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing plugin slug');
          if (context?.dryRun === true) {
            return { dryRun: true, operation: 'plugins.update', slug };
          }
          const manifest = await this.manager.installOrUpdateFromMarketplace(slug);
          return { dryRun: false, operation: 'plugins.update', slug, manifest };
        },
      },
      {
        tool: 'plugins.enable',
        readOnly: false,
        description: 'Enable installed plugin.',
        handler: async (input, context) => {
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing plugin slug');
          if (context?.dryRun === true) {
            return { dryRun: true, operation: 'plugins.enable', slug };
          }
          await this.manager.enable(slug, {
            force: parseBoolean(input?.force),
            recursive: parseBoolean(input?.recursive) !== false,
          });
          return { dryRun: false, operation: 'plugins.enable', slug };
        },
      },
      {
        tool: 'plugins.disable',
        readOnly: false,
        description: 'Disable installed plugin.',
        handler: async (input, context) => {
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing plugin slug');
          if (context?.dryRun === true) {
            return { dryRun: true, operation: 'plugins.disable', slug };
          }
          await this.manager.disable(slug);
          return { dryRun: false, operation: 'plugins.disable', slug };
        },
      },
      {
        tool: 'plugins.settings.get',
        readOnly: true,
        description: 'Get plugin configuration/settings by slug.',
        handler: async (input) => {
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing plugin slug');
          const config = this.readPluginConfig(slug);
          const schema = this.manager.getPluginSettings(slug);
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
          const queryLower = this.normalizeSearchText(query);
          const queryTokens = this.tokenizeSearchQuery(query);
          const requestedSlug = this.toAssistantSlug(String(input?.slug || ''), '');
          const maxMatches = Math.min(200, Math.max(1, Number(input?.maxMatches || 40)));

          const pluginSlugs = requestedSlug
            ? [requestedSlug]
            : this.manager
                .getSortedPlugins(this.manager.getPlugins())
                .map((plugin: any) => this.toAssistantSlug(String(plugin?.manifest?.slug || ''), ''))
                .filter(Boolean);

          const matches: Array<{ slug: string; path: string; value: string }> = [];
          for (const slug of pluginSlugs) {
            if (matches.length >= maxMatches) break;
            const config = this.readPluginConfig(slug);
            const found = this.collectObjectStringMatches(config, queryLower, queryTokens, 'config');
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
        tool: 'plugins.settings.update',
        readOnly: false,
        description: 'Update plugin configuration/settings by slug.',
        handler: async (input, context) => {
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing plugin slug');
          const patch = input?.config && typeof input.config === 'object'
            ? input.config
            : input?.data && typeof input.data === 'object'
              ? input.data
              : {};
          const merge = input?.merge !== false;
          const current = this.readPluginConfig(slug);
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

          await this.manager.savePluginConfig(slug, nextConfig);
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
              slug: this.toAssistantSlug(String(input?.slug || input?.name || ''), 'plugin'),
              name: this.toAssistantTitle(String(input?.name || ''), 'plugin'),
              activate: parseBoolean(input?.activate) !== false,
            };
          }
          const created = await this.scaffoldPlugin(input || {});
          return {
            dryRun: false,
            operation: 'plugins.create.scaffold',
            ...created,
            plugins: pluginSummary(),
          };
        },
      },
      {
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
          const themes = await this.themeManager.getMarketplaceThemes();
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
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          const version = String(input?.version || '').trim();
          if (!slug) throw new Error('Missing theme slug');
          const activate = parseBoolean(input?.activate) !== false;
          if (context?.dryRun === true) {
            return { dryRun: true, operation: 'themes.install', slug, version: version || null, activate };
          }

          const themes = await this.themeManager.getMarketplaceThemes();
          const pkg = themes.find((entry: any) => {
            const entrySlug = this.toAssistantSlug(String(entry?.slug || ''), '');
            if (entrySlug !== slug) return false;
            if (!version) return true;
            return String(entry?.version || '').trim() === version;
          });
          if (!pkg) {
            throw new Error(`Theme "${slug}"${version ? ` (${version})` : ''} not found in marketplace.`);
          }

          await this.themeManager.installTheme(pkg);
          let activated = false;
          let activationError: string | null = null;
          if (activate) {
            try {
              await this.themeManager.activateTheme(slug);
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
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing theme slug');
          if (context?.dryRun === true) {
            return { dryRun: true, operation: 'themes.update', slug };
          }

          const themes = await this.themeManager.getMarketplaceThemes();
          const pkg = themes.find((entry: any) => this.toAssistantSlug(String(entry?.slug || ''), '') === slug);
          if (!pkg) throw new Error(`Theme "${slug}" not found in marketplace.`);
          await this.themeManager.installTheme(pkg);
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
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing theme slug');
          if (context?.dryRun === true) {
            return { dryRun: true, operation: 'themes.activate', slug };
          }
          await this.themeManager.activateTheme(slug);
          return { dryRun: false, operation: 'themes.activate', slug, themes: themeSummary() };
        },
      },
      {
        tool: 'themes.config.get',
        readOnly: true,
        description: 'Get theme configuration by slug.',
        handler: async (input) => {
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing theme slug');
          const config = await this.themeManager.getThemeConfig(slug);
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
          const queryLower = this.normalizeSearchText(query);
          const queryTokens = this.tokenizeSearchQuery(query);
          const requestedSlug = this.toAssistantSlug(String(input?.slug || ''), '');
          const maxMatches = Math.min(200, Math.max(1, Number(input?.maxMatches || 40)));

          const themeSlugs = requestedSlug
            ? [requestedSlug]
            : this.themeManager
                .getThemes()
                .map((theme: any) => this.toAssistantSlug(String(theme?.slug || ''), ''))
                .filter(Boolean);

          const matches: Array<{ slug: string; path: string; value: string }> = [];
          for (const slug of themeSlugs) {
            if (matches.length >= maxMatches) break;
            const config = await this.themeManager.getThemeConfig(slug);
            const safeConfig = config && typeof config === 'object' ? config : {};
            const found = this.collectObjectStringMatches(safeConfig, queryLower, queryTokens, 'config');
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
        tool: 'themes.config.update',
        readOnly: false,
        description: 'Update theme configuration by slug.',
        handler: async (input, context) => {
          const slug = this.toAssistantSlug(String(input?.slug || ''), '');
          if (!slug) throw new Error('Missing theme slug');
          const patch = input?.config && typeof input.config === 'object'
            ? input.config
            : input?.data && typeof input.data === 'object'
              ? input.data
              : {};
          const merge = input?.merge !== false;
          const currentConfig = await this.themeManager.getThemeConfig(slug);
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

          await this.themeManager.saveThemeConfig(slug, nextConfig);
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
              slug: this.toAssistantSlug(String(input?.slug || input?.name || ''), 'theme'),
              name: this.toAssistantTitle(String(input?.name || ''), 'theme'),
              activate: parseBoolean(input?.activate) !== false,
            };
          }
          const created = await this.scaffoldTheme(input || {});
          return {
            dryRun: false,
            operation: 'themes.create.scaffold',
            ...created,
            themes: themeSummary(),
          };
        },
      },
      {
        tool: 'backups.list',
        readOnly: true,
        description: 'List available backup files.',
        handler: async () => {
          const backupsRoot = path.resolve(getProjectRoot(), 'backups');
          if (!fs.existsSync(backupsRoot)) {
            return { backups: [] };
          }
          const types = fs.readdirSync(backupsRoot).filter((entry) => {
            const full = path.join(backupsRoot, entry);
            return fs.statSync(full).isDirectory();
          });
          const backups: Array<{ type: string; file: string; path: string; updatedAt: number }> = [];
          for (const type of types) {
            const dir = path.join(backupsRoot, type);
            for (const file of fs.readdirSync(dir)) {
              const full = path.join(dir, file);
              if (!fs.statSync(full).isFile()) continue;
              backups.push({
                type,
                file,
                path: full,
                updatedAt: fs.statSync(full).mtimeMs,
              });
            }
          }
          backups.sort((a, b) => b.updatedAt - a.updatedAt);
          return { backups };
        },
      },
      {
        tool: 'backups.create.system',
        readOnly: false,
        description: 'Create a full system backup snapshot.',
        handler: async (_input, context) => {
          if (context?.dryRun === true) {
            return {
              dryRun: true,
              operation: 'backups.create.system',
              note: 'Would create a full filesystem+database backup snapshot.',
            };
          }
          const backupPath = await BackupService.createSystemBackup();
          return {
            dryRun: false,
            operation: 'backups.create.system',
            backupPath,
          };
        },
      },
      {
        tool: 'backups.restore.path',
        readOnly: false,
        description: 'Restore a backup archive to a target directory (requires explicit approval).',
        handler: async (input, context) => {
          const backupPathInput = String(input?.backupPath || '').trim();
          const targetDirInput = String(input?.targetDir || '').trim();
          if (!backupPathInput) throw new Error('Missing backupPath');
          if (!targetDirInput) throw new Error('Missing targetDir');

          const resolvedBackupPath = path.isAbsolute(backupPathInput)
            ? backupPathInput
            : path.resolve(getProjectRoot(), backupPathInput.replace(/^\/+/, ''));
          const resolvedTargetDir = path.isAbsolute(targetDirInput)
            ? targetDirInput
            : path.resolve(getProjectRoot(), targetDirInput.replace(/^\/+/, ''));

          if (context?.dryRun === true) {
            return {
              dryRun: true,
              operation: 'backups.restore.path',
              backupPath: resolvedBackupPath,
              targetDir: resolvedTargetDir,
            };
          }

          await BackupService.restore(resolvedBackupPath, resolvedTargetDir);
          return {
            dryRun: false,
            operation: 'backups.restore.path',
            backupPath: resolvedBackupPath,
            targetDir: resolvedTargetDir,
          };
        },
      },
    ];
  }

  private toAssistantSlug(value: string, fallback: string = 'item'): string {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  private toAssistantTitle(value: string, fallback: string): string {
    const text = String(value || '').trim();
    return text || fallback;
  }

  private readPluginConfig(slug: string): Record<string, any> {
    const plugin = this.manager.getPlugins().find((entry: any) => String(entry?.manifest?.slug || '').trim().toLowerCase() === slug);
    const config = plugin?.manifest?.config;
    return config && typeof config === 'object' ? { ...config } : {};
  }

  private isPotentialLocaleKey(key: string): boolean {
    return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(key || '').trim());
  }

  private tokenizeSearchQuery(query: string): string[] {
    return this.normalizeSearchText(query)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }

  private tokenVariants(token: string): string[] {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return [];
    const variants = new Set<string>([normalized]);
    if (normalized.endsWith('s') && normalized.length > 3) {
      variants.add(normalized.slice(0, -1));
    } else if (!normalized.endsWith('s') && normalized.length > 3) {
      variants.add(`${normalized}s`);
    }
    return Array.from(variants);
  }

  private textMatchesQuery(value: string, queryLower: string, queryTokens: string[]): boolean {
    const normalized = this.normalizeSearchText(value);
    if (!normalized) return false;
    if (queryLower && normalized.includes(queryLower)) return true;
    if (!queryTokens.length) return false;
    return queryTokens.every((token) => this.tokenVariants(token).some((variant) => normalized.includes(variant)));
  }

  private collectObjectStringMatches(
    value: any,
    queryLower: string,
    queryTokens: string[],
    basePath: string,
    depth: number = 0,
    maxDepth: number = 5
  ): Array<{ path: string; value: string }> {
    if (depth > maxDepth) return [];
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
      if (!this.textMatchesQuery(value, queryLower, queryTokens)) return [];
      return [{ path: basePath || 'value', value }];
    }

    if (Array.isArray(value)) {
      const output: Array<{ path: string; value: string }> = [];
      for (let index = 0; index < value.length; index += 1) {
        const nextPath = `${basePath}[${index}]`;
        output.push(...this.collectObjectStringMatches(value[index], queryLower, queryTokens, nextPath, depth + 1, maxDepth));
      }
      return output;
    }

    if (typeof value === 'object') {
      const output: Array<{ path: string; value: string }> = [];
      for (const [rawKey, nestedValue] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        if (key.startsWith('_')) continue;
        const keySegment = this.isPotentialLocaleKey(key) ? `[${key}]` : key;
        const nextPath = basePath ? `${basePath}.${keySegment}` : keySegment;
        output.push(...this.collectObjectStringMatches(nestedValue, queryLower, queryTokens, nextPath, depth + 1, maxDepth));
      }
      return output;
    }

    return [];
  }

  private async scaffoldPlugin(input: any): Promise<any> {
    const slug = this.toAssistantSlug(String(input?.slug || input?.name || ''), 'plugin');
    const name = this.toAssistantTitle(String(input?.name || ''), slug);
    const description = String(input?.description || '').trim();
    const version = String(input?.version || '1.0.0').trim() || '1.0.0';
    const activate = parseBoolean(input?.activate) !== false;
    const pluginsDir = getPluginsDir();
    const pluginPath = path.join(pluginsDir, slug);

    if (this.manager.getPlugins().some((plugin: any) => String(plugin?.manifest?.slug || '').trim().toLowerCase() === slug)) {
      throw new Error(`Plugin "${slug}" already exists.`);
    }
    if (fs.existsSync(pluginPath)) {
      throw new Error(`Plugin path already exists: ${pluginPath}`);
    }

    fs.mkdirSync(path.join(pluginPath, 'ui'), { recursive: true });
    const manifest = {
      slug,
      name,
      version,
      description,
      main: 'index.js',
      capabilities: ['api', 'hooks', 'ui'],
      ui: {
        entry: 'index.js',
      },
    };

    const pluginMain = [
      "'use strict';",
      '',
      'module.exports = {',
      '  async onInit(context) {',
      `    context.logger.info('${name} initialized.');`,
      '  },',
      '  async onEnable(context) {',
      `    context.logger.info('${name} enabled.');`,
      '  },',
      '  async onDisable(context) {',
      `    context.logger.info('${name} disabled.');`,
      '  },',
      '};',
      '',
    ].join('\n');

    const uiEntry = [
      'export const init = () => {',
      `  console.info('[${slug}] UI initialized.');`,
      '};',
      '',
      'if (typeof window !== "undefined" && (window).Fromcode) {',
      '  init();',
      '}',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'index.js'), pluginMain, 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'ui', 'index.js'), uiEntry, 'utf8');

    await this.manager.discoverPlugins();

    let activated = false;
    let activationError: string | null = null;
    if (activate) {
      try {
        await this.manager.enable(slug);
        activated = true;
      } catch (error: any) {
        activationError = String(error?.message || 'Activation failed');
      }
    }

    return {
      slug,
      name,
      path: pluginPath,
      activated,
      activationError,
      manifest,
    };
  }

  private async scaffoldTheme(input: any): Promise<any> {
    const slug = this.toAssistantSlug(String(input?.slug || input?.name || ''), 'theme');
    const name = this.toAssistantTitle(String(input?.name || ''), slug);
    const description = String(input?.description || '').trim();
    const version = String(input?.version || '1.0.0').trim() || '1.0.0';
    const activate = parseBoolean(input?.activate) !== false;
    const themesDir = getThemesDir();
    const themePath = path.join(themesDir, slug);

    if (this.themeManager.getThemes().some((theme: any) => String(theme?.slug || '').trim().toLowerCase() === slug)) {
      throw new Error(`Theme "${slug}" already exists.`);
    }
    if (fs.existsSync(themePath)) {
      throw new Error(`Theme path already exists: ${themePath}`);
    }

    fs.mkdirSync(path.join(themePath, 'ui'), { recursive: true });
    const themeManifest = {
      slug,
      name,
      version,
      description,
      author: 'Forge',
      ui: {
        entry: 'index.js',
        css: ['theme.css'],
      },
      variables: {
        primary: '#0ea5e9',
        accent: '#f97316',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
      },
    };

    const uiEntry = [
      "import './theme.css';",
      '',
      'export const init = () => {',
      `  console.info('[theme:${slug}] initialized.');`,
      '};',
      '',
      'if (typeof window !== "undefined") {',
      '  init();',
      '}',
      '',
    ].join('\n');

    const themeCss = [
      ':root {',
      '  --theme-primary: #0ea5e9;',
      '  --theme-accent: #f97316;',
      '  --theme-background: #ffffff;',
      '  --theme-surface: #f8fafc;',
      '  --theme-text: #0f172a;',
      '}',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(themePath, 'theme.json'), `${JSON.stringify(themeManifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(themePath, 'ui', 'index.js'), uiEntry, 'utf8');
    fs.writeFileSync(path.join(themePath, 'ui', 'theme.css'), themeCss, 'utf8');

    await this.themeManager.discoverThemes();

    let activated = false;
    let activationError: string | null = null;
    if (activate) {
      try {
        await this.themeManager.activateTheme(slug);
        activated = true;
      } catch (error: any) {
        activationError = String(error?.message || 'Activation failed');
      }
    }

    return {
      slug,
      name,
      path: themePath,
      activated,
      activationError,
      manifest: themeManifest,
    };
  }
}
