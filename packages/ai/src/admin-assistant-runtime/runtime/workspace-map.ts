import type {
  AdminAssistantRuntimeOptions,
  AssistantCollectionContext,
  AssistantToolSummary,
  AssistantWorkspaceMap,
  AssistantWorkspaceMapCollection,
  AssistantWorkspaceMapPlugin,
  AssistantWorkspaceMapTheme,
  AssistantWorkspaceMapTool,
} from '../types';
import { TextHelpers } from './helpers/text-helpers';

export class WorkspaceMapService {
  static isWorkspaceInventoryRequest(message: string): boolean {
      const text = TextHelpers.normalizeToken(message);
      if (!text) return false;
      const asksList = /\b(list|show|what|which|inventory)\b/.test(text);
      const asksPlugins = /\bplugin\b|\bplugins\b/.test(text);
      const asksThemes = /\btheme\b|\bthemes\b/.test(text);
      const asksCollections = /\bcollection\b|\bcollections\b|\beditable\b|\bcontent types?\b/.test(text);
      const hitCount = [asksPlugins, asksThemes, asksCollections].filter(Boolean).length;
      return asksList && hitCount >= 2;

  }

  static buildWorkspaceInventoryMessage(map: AssistantWorkspaceMap): string {
      const plugins = Array.isArray(map.plugins) ? map.plugins : [];
      const themes = Array.isArray(map.themes) ? map.themes : [];
      const collections = Array.isArray(map.collections) ? map.collections : [];
      const activeTheme =
        themes.find((theme) => String(theme.state || '').toLowerCase() === 'active') ||
        (map.activeThemeSlug ? themes.find((theme) => theme.slug === map.activeThemeSlug) : undefined);

      const pluginLines = plugins.length
        ? plugins
            .slice(0, 8)
            .map((item) => `- ${item.name || item.slug} (${item.slug}) • ${item.version || 'n/a'} • ${item.state || 'unknown'}`)
            .join('\n')
        : '- None detected';

      const collectionLines = collections.length
        ? collections
            .slice(0, 12)
            .map((item) => `- ${item.label || item.slug} (${item.shortSlug || item.slug})`)
            .join('\n')
        : '- None detected';

      return [
        'Here is your current workspace inventory:',
        '',
        `Installed plugins (${plugins.length}):`,
        pluginLines,
        '',
        `Active theme: ${activeTheme ? `${activeTheme.name || activeTheme.slug} (${activeTheme.slug})` : 'No active theme'}`,
        '',
        `Editable collections (${collections.length}):`,
        collectionLines,
      ].join('\n');

  }

  static findWorkspaceEntityReply(message: string, map: AssistantWorkspaceMap): string | null {
      const token = TextHelpers.normalizeToken(message);
      if (!token) return null;
      const collection = WorkspaceMapService.matchWorkspaceCollection(message, map);
      if (collection) {
        const asksForRows = /\b(list|show|what|which|who|have|records?|entries|rows|docs?|data)\b/.test(token);
        const fields = Array.isArray(collection.fieldNames) && collection.fieldNames.length
          ? `Fields: ${collection.fieldNames.slice(0, 8).join(', ')}.`
          : '';
        return [
          `\`${collection.slug}\` is editable (plugin: ${collection.pluginSlug}).`,
          fields,
          asksForRows
            ? `I can list current records. Try: "list first 10 from ${collection.slug}".`
            : `Try: "list first 10 from ${collection.slug}" or "update ${collection.slug} id 1 field title to ...".`,
        ].filter(Boolean).join(' ');
      }

      const plugin = (Array.isArray(map.plugins) ? map.plugins : []).find((entry) => {
        const slug = TextHelpers.normalizeToken(entry.slug);
        const name = TextHelpers.normalizeToken(entry.name);
        return token === slug || token === name;
      });
      if (plugin) {
        const caps = Array.isArray(plugin.capabilities) && plugin.capabilities.length
          ? `Capabilities: ${plugin.capabilities.slice(0, 6).join(', ')}.`
          : '';
        return [
          `\`${plugin.slug}\` is installed (${plugin.state || 'unknown'}).`,
          caps,
          plugin.path ? `Path: ${plugin.path}.` : '',
          `I can inspect settings, search plugin files, or stage safe config/file updates.`,
        ].filter(Boolean).join(' ');
      }

      const theme = (Array.isArray(map.themes) ? map.themes : []).find((entry) => {
        const slug = TextHelpers.normalizeToken(entry.slug);
        const name = TextHelpers.normalizeToken(entry.name);
        return token === slug || token === name;
      });
      if (theme) {
        return [
          `\`${theme.slug}\` is a theme (${theme.state || 'inactive'}).`,
          theme.path ? `Path: ${theme.path}.` : '',
          `I can inspect theme config, search theme files, or stage safe updates.`,
        ].filter(Boolean).join(' ');
      }

      return null;

  }

  static matchWorkspaceCollection(message: string, map: AssistantWorkspaceMap): AssistantWorkspaceMapCollection | null {
      const token = TextHelpers.normalizeToken(message);
      if (!token) return null;
      const collections = Array.isArray(map.collections) ? map.collections : [];
      const words = token.split(' ').filter(Boolean);
      let best: { score: number; item: AssistantWorkspaceMapCollection } | null = null;

      for (const entry of collections) {
        const aliases = WorkspaceMapService.uniqueByKey(
          [entry.slug, entry.shortSlug, entry.label]
            .map((value) => TextHelpers.normalizeToken(value))
            .filter(Boolean),
          (value) => value,
        );
        let score = 0;
        for (const alias of aliases) {
          if (!alias) continue;
          if (token === alias) {
            score = Math.max(score, 3);
            continue;
          }
          const boundary = new RegExp(`\\b${TextHelpers.escapeRegExp(alias)}\\b`);
          if (boundary.test(token)) {
            score = Math.max(score, 2);
            continue;
          }
          if (alias.includes(' ')) {
            const parts = alias.split(' ').filter(Boolean);
            if (parts.length > 1 && parts.every((part) => words.includes(part))) {
              score = Math.max(score, 1.5);
              continue;
            }
          } else if (alias.length >= 3 && words.includes(alias)) {
            score = Math.max(score, 1.25);
          }
        }
        if (score <= 0) continue;
        if (!best || score > best.score) {
          best = { score, item: entry };
        }
      }

      return best ? best.item : null;

  }

  static buildWorkspaceMap(input: {
    options: AdminAssistantRuntimeOptions;
    collections: AssistantCollectionContext[];
    tools: AssistantToolSummary[];
  }): AssistantWorkspaceMap {
    return WorkspaceMapService.defaultMapFromOptions(input);
  }

  static buildWorkspacePromptSummary(map: AssistantWorkspaceMap): string {
      const plugins = (Array.isArray(map.plugins) ? map.plugins : []).slice(0, 12);
      const themes = (Array.isArray(map.themes) ? map.themes : []).slice(0, 8);
      const collections = (Array.isArray(map.collections) ? map.collections : []).slice(0, 20);
      const tools = (Array.isArray(map.tools) ? map.tools : []).slice(0, 30);

      const pluginLine = plugins.length
        ? plugins.map((plugin) => `${plugin.slug}${plugin.state ? `(${plugin.state})` : ''}`).join(', ')
        : 'none';
      const themeLine = themes.length
        ? themes.map((theme) => `${theme.slug}${theme.state ? `(${theme.state})` : ''}`).join(', ')
        : 'none';
      const collectionLine = collections.length
        ? collections.map((collection) => collection.slug).join(', ')
        : 'none';
      const toolLine = tools.length
        ? tools.map((tool) => `${tool.tool}${tool.readOnly ? '[ro]' : '[rw]'}`).join(', ')
        : 'none';

      return [
        'Workspace map:',
        `- plugins: ${pluginLine}`,
        `- themes: ${themeLine}`,
        `- activeTheme: ${map.activeThemeSlug || 'none'}`,
        `- collections: ${collectionLine}`,
        `- tools: ${toolLine}`,
      ].join('\n');

  }

  private static uniqueByKey<T>(items: T[], keyOf: (value: T) => string): T[] {
    const seen = new Set<string>();
    const output: T[] = [];
    for (const item of Array.isArray(items) ? items : []) {
      const key = String(keyOf(item) || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    return output;
  }

  private static defaultMapFromOptions(input: {
    options: AdminAssistantRuntimeOptions;
    collections: AssistantCollectionContext[];
    tools: AssistantToolSummary[];
  }): AssistantWorkspaceMap {
  const pluginsRaw = typeof input.options.getPlugins === 'function' ? input.options.getPlugins() || [] : [];
  const themesRaw = typeof input.options.getThemes === 'function' ? input.options.getThemes() || [] : [];

  const plugins: AssistantWorkspaceMapPlugin[] = WorkspaceMapService.uniqueByKey(
    pluginsRaw.map((plugin: any) => ({
      slug: String(plugin?.slug || '').trim(),
      name: String(plugin?.name || plugin?.slug || '').trim(),
      version: String(plugin?.version || '').trim() || undefined,
      state: String(plugin?.state || '').trim() || undefined,
      capabilities: Array.isArray(plugin?.capabilities)
        ? plugin.capabilities.map((cap: any) => String(cap || '').trim()).filter(Boolean)
        : undefined,
      path: String(plugin?.path || '').trim() || undefined,
    })),
    (item) => item.slug,
  );

  const themes: AssistantWorkspaceMapTheme[] = WorkspaceMapService.uniqueByKey(
    themesRaw.map((theme: any) => ({
      slug: String(theme?.slug || '').trim(),
      name: String(theme?.name || theme?.slug || '').trim(),
      version: String(theme?.version || '').trim() || undefined,
      state: String(theme?.state || '').trim() || undefined,
      path: String(theme?.path || '').trim() || undefined,
    })),
    (item) => item.slug,
  );

  const collections: AssistantWorkspaceMapCollection[] = WorkspaceMapService.uniqueByKey(
    input.collections.map((collection: any) => ({
      slug: String(collection?.slug || '').trim(),
      shortSlug: String(collection?.shortSlug || collection?.slug || '').trim(),
      label: String(collection?.label || collection?.slug || '').trim(),
      pluginSlug: String(collection?.pluginSlug || 'system').trim(),
      fieldNames: Array.isArray(collection?.raw?.fields)
        ? collection.raw.fields.map((field: any) => String(field?.name || '').trim()).filter(Boolean).slice(0, 40)
        : undefined,
    })),
    (item) => item.slug,
  );

  const tools: AssistantWorkspaceMapTool[] = WorkspaceMapService.uniqueByKey(
    (Array.isArray(input.tools) ? input.tools : []).map((tool: any) => ({
      tool: String(tool?.tool || '').trim(),
      readOnly: tool?.readOnly === true,
    })),
    (item) => item.tool,
  );

    const activeTheme = themes.find((theme) => String(theme.state || '').toLowerCase() === 'active');

    return {
      generatedAt: Date.now(),
      plugins,
      themes,
      collections,
      tools,
      activeThemeSlug: activeTheme?.slug,
    };
  }
}