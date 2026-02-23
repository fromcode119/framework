import { Collection, HookManager, PluginManager, sanitizeKey, parseAttributes, resolveCollection } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';

export interface ShortcodeDefinition {
  name: string;
  provider: string;
  description: string;
  aliases?: string[];
  attributes: string[];
}

export class ShortcodeService {
  constructor(
    private manager: PluginManager,
    private restController: RESTController
  ) {}

  async getRegisteredShortcodes(): Promise<ShortcodeDefinition[]> {
    const builtIn = this.getBuiltInShortcodes();
    try {
      const hooks = (this.manager as any)?.hooks as HookManager;
      if (!hooks) return builtIn;

      const payload = await hooks.call('system:shortcodes:register', {
        shortcodes: [...builtIn]
      });

      const registered = Array.isArray(payload?.shortcodes) ? payload.shortcodes : builtIn;

      return registered
        .map((item: any) => {
          const name = sanitizeKey(item?.name);
          if (!name) return null;
          const aliases = Array.isArray(item?.aliases)
            ? item.aliases.map((alias: any) => sanitizeKey(alias)).filter(Boolean)
            : [];

          return {
            name,
            aliases: Array.from(new Set(aliases.filter((alias: string) => alias !== name))),
            provider: String(item?.provider || 'system'),
            description: String(item?.description || ''),
            attributes: Array.isArray(item?.attributes)
              ? item.attributes.map((value: any) => String(value))
              : []
          };
        })
        .filter(Boolean) as ShortcodeDefinition[];
    } catch {
      return builtIn;
    }
  }

  private getBuiltInShortcodes(): ShortcodeDefinition[] {
    return [
      {
        name: 'inject',
        provider: 'system',
        description: 'Render cross-plugin collection data.',
        attributes: [
          'source or plugin+collection',
          'field/select',
          'limit',
          'sort',
          'filterKey/filterValue',
          'filter',
          'join',
          'template',
          'prefix/suffix',
          'empty'
        ]
      }
    ];
  }

  async render(content: string, options: { user?: any; maxShortcodes?: number } = {}): Promise<{
    rendered: string;
    replaced: number;
    matches: any[];
  }> {
    if (!content) return { rendered: '', replaced: 0, matches: [] };

    const maxShortcodes = Math.min(Math.max(options.maxShortcodes || 20, 1), 100);
    const definitions = await this.getRegisteredShortcodes();
    const shortcodeMap = new Map<string, ShortcodeDefinition>();

    definitions.forEach(def => {
      shortcodeMap.set(def.name, def);
      def.aliases?.forEach(alias => shortcodeMap.set(alias, def));
    });

    const pattern = /\[([a-zA-Z][a-zA-Z0-9_-]*)\s*([^\]]*)\]/g;
    const matches: any[] = [];
    let rendered = '';
    let lastIndex = 0;
    let token: RegExpExecArray | null;
    let replaced = 0;

    while ((token = pattern.exec(content)) !== null) {
      if (replaced >= maxShortcodes) break;

      const [shortcode, rawTag, rawAttrs] = token;
      rendered += content.slice(lastIndex, token.index);
      const tag = sanitizeKey(rawTag);
      const definition = shortcodeMap.get(tag);

      if (!definition) {
        rendered += shortcode;
      } else {
        const attrs = parseAttributes(rawAttrs);
        try {
          let replacement = '';
          if (definition.name === 'inject') {
            replacement = await this.renderInjectShortcode(attrs, options.user);
          } else {
            const resolved = await (this.manager as any).hooks.call('system:shortcodes:resolve', {
              name: definition.name,
              tag,
              attrs,
              user: options.user,
              handled: false,
              output: ''
            });
            replacement = resolved?.handled ? String(resolved.output || '') : shortcode;
          }

          rendered += replacement;
          matches.push({
            shortcode,
            name: definition.name,
            source: attrs.source || `${attrs.plugin || ''}:${attrs.collection || ''}`,
            rendered: replacement
          });
        } catch (err: any) {
          const fallback = String(attrs.empty || '');
          rendered += fallback;
          matches.push({
            shortcode,
            name: definition.name,
            error: err?.message || 'Failed to resolve'
          });
        }
        replaced++;
      }
      lastIndex = pattern.lastIndex;
    }

    rendered += content.slice(lastIndex);
    return { rendered, replaced, matches };
  }

  private async renderInjectShortcode(attrs: Record<string, string>, user: any): Promise<string> {
    const source = String(attrs.source || '').trim();
    let pluginSlug = String(attrs.plugin || attrs.pluginSlug || '').trim();
    let collectionSlug = String(attrs.collection || attrs.collectionSlug || '').trim();

    if (source && (!pluginSlug || !collectionSlug)) {
      const parts = source.includes(':') ? source.split(':') : source.split('/');
      if (parts.length >= 2) {
        pluginSlug = parts[0];
        collectionSlug = parts.slice(1).join(':');
      } else {
        collectionSlug = parts[0];
      }
    }

    if (!collectionSlug) return '';

    const collection = resolveCollection(this.manager.getCollections(), pluginSlug, collectionSlug);

    if (!collection || collection.system || collection.slug.startsWith('_')) return '';

    const query: any = {
      limit: String(Math.min(Math.max(parseInt(attrs.limit || '6'), 1), 100)),
      sort: /^-?[a-zA-Z0-9_]+$/.test(attrs.sort || '') ? attrs.sort : '-id'
    };

    const filterPair = String(attrs.filter || '').trim();
    if (filterPair) {
      const sep = filterPair.indexOf(':');
      if (sep > 0) {
        query[filterPair.slice(0, sep).trim()] = filterPair.slice(sep + 1).trim();
      }
    }
    if (attrs.filterKey && attrs.filterValue) query[attrs.filterKey] = attrs.filterValue;

    const result: any = await this.restController.find(collection, { query, user } as any);
    const docs = Array.isArray(result?.docs) ? result.docs : [];
    if (docs.length === 0) return attrs.empty || '';

    const template = String(attrs.template || '').trim();
    const joinChar = attrs.join !== undefined ? String(attrs.join) : ', ';

    let renderedResult = '';
    if (template) {
      renderedResult = docs.map((doc: any) => {
        return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, field) => {
          const val = doc?.[field];
          return val === undefined || val === null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
        });
      }).join(joinChar);
    } else {
      const field = /^[a-zA-Z0-9_]+$/.test(attrs.field || attrs.select || '') ? (attrs.field || attrs.select) : 'title';
      renderedResult = docs.map((doc: any) => {
        const val = doc?.[field] ?? doc?.title ?? doc?.name ?? doc?.slug ?? '';
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }).filter(Boolean).join(joinChar);
    }

    return renderedResult ? `${attrs.prefix || ''}${renderedResult}${attrs.suffix || ''}` : (attrs.empty || '');
  }
}
