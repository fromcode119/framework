import { parse } from 'yaml';

/**
 * Parses compose files and lays later ones over earlier ones, as `docker compose -f a -f b` does.
 *
 * Mappings merge key by key; `environment` and `labels` merge by variable name and `volumes` by the
 * path inside the container, so an override replaces one entry without restating the rest; `command`,
 * `entrypoint` and every other scalar are replaced; any other list is appended without repeats.
 * `!reset` removes what the earlier files said (the images file's `build: !reset null`), `!override`
 * replaces it whole.
 */
export class ComposeFileMerge {
  private static readonly RESET = Symbol('compose-reset');
  private static readonly OVERRIDE = Symbol('compose-override');
  private static readonly REPLACED_LISTS = new Set(['command', 'entrypoint', 'test']);
  private static readonly KEYED_LISTS = new Set(['environment', 'labels']);

  static parse(text: string, file: string): Record<string, any> {
    const reset = { tag: '!reset', resolve: () => ComposeFileMerge.RESET };
    const override = (extra: Record<string, string>) => ({
      tag: '!override', ...extra,
      resolve: (value: any) => ({ [ComposeFileMerge.OVERRIDE]: ComposeFileMerge.plain(value) }),
    });
    const document = parse(text, {
      merge: true,
      customTags: [reset, { ...reset, collection: 'map' }, { ...reset, collection: 'seq' }, override({}), override({ collection: 'map' }), override({ collection: 'seq' })],
    });
    if (!document || typeof document !== 'object') throw new Error(`${file} holds no compose document.`);
    return document;
  }

  static merge(base: any, over: any, key = ''): any {
    if (over === ComposeFileMerge.RESET) return undefined;
    if (over && typeof over === 'object' && ComposeFileMerge.OVERRIDE in over) return over[ComposeFileMerge.OVERRIDE];
    if (base === undefined) return ComposeFileMerge.clean(over);
    if (ComposeFileMerge.KEYED_LISTS.has(key)) return { ...ComposeFileMerge.keyed(base), ...ComposeFileMerge.keyed(over) };
    if (Array.isArray(base) && Array.isArray(over)) return ComposeFileMerge.lists(base, over, key);
    if (ComposeFileMerge.isMap(base) && ComposeFileMerge.isMap(over)) {
      const merged: Record<string, any> = { ...base };
      for (const [name, value] of Object.entries(over)) {
        const next = ComposeFileMerge.merge(base[name], value, name);
        if (next === undefined) delete merged[name]; else merged[name] = next;
      }
      return merged;
    }
    return ComposeFileMerge.clean(over);
  }

  /** `- KEY=value` lists and `KEY: value` maps, as one map (`null` for a bare `- KEY`). */
  static keyed(value: unknown): Record<string, string | null> {
    if (Array.isArray(value)) {
      return Object.fromEntries(value.map((entry) => {
        const text = String(entry);
        const at = text.indexOf('=');
        return at === -1 ? [text, null] : [text.slice(0, at), text.slice(at + 1)];
      }));
    }
    if (ComposeFileMerge.isMap(value)) {
      return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, item === null || item === undefined ? null : String(item)]));
    }
    return {};
  }

  static isMap(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private static lists(base: any[], over: any[], key: string): any[] {
    if (ComposeFileMerge.REPLACED_LISTS.has(key)) return over;
    if (key === 'volumes') {
      const target = (entry: any) => ComposeFileMerge.isMap(entry) ? String(entry.target) : String(entry).split(':')[1] ?? String(entry);
      const replaced = new Set(over.map(target));
      return [...base.filter((entry) => !replaced.has(target(entry))), ...over];
    }
    const seen = new Set(base.map((entry) => JSON.stringify(entry)));
    return [...base, ...over.filter((entry) => !seen.has(JSON.stringify(entry)))];
  }

  /** A first mention carries no markers: a `!reset` there means "absent", an `!override` its value. */
  private static clean(value: any): any {
    if (value === ComposeFileMerge.RESET) return undefined;
    if (value && typeof value === 'object' && ComposeFileMerge.OVERRIDE in value) return value[ComposeFileMerge.OVERRIDE];
    if (Array.isArray(value)) return value.map((item) => ComposeFileMerge.clean(item));
    if (ComposeFileMerge.isMap(value)) {
      return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, ComposeFileMerge.clean(item)]).filter(([, item]) => item !== undefined));
    }
    return value;
  }

  private static plain(value: any): any {
    return value && typeof value.toJSON === 'function' ? value.toJSON() : value;
  }
}
