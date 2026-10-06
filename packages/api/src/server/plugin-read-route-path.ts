import type { IPluginReadRoute } from '@fromcode119/core';

/**
 * Whether a request path is a read route's path, and what its named segments say (`/products/:slug`).
 * A path with no named segment must equal the request's, whatever the case, as it always has.
 */
export class PluginReadRoutePath {
  private static readonly compiled = new Map<string, RegExp>();

  /** The segment values by name when `rest` is the route's path, `{}` for a plain path, else `null`. */
  static match(route: IPluginReadRoute, rest: string): Record<string, string> | null {
    const template = String(route.path || '');
    if (!template.includes(':')) return template.toLowerCase() === rest.toLowerCase() ? {} : null;
    const found = PluginReadRoutePath.pattern(template).exec(rest);
    if (!found) return null;
    const values: Record<string, string> = {};
    const names = [...template.matchAll(/:([A-Za-z0-9_]+)/g)].map((entry) => entry[1]);
    for (let index = 0; index < names.length; index += 1) {
      let value: string;
      try { value = decodeURIComponent(found[index + 1]); } catch { return null; }
      const declared = route.params?.[names[index]];
      if (!declared || !value || value.includes('/')) return null;
      if (declared.accepts && !new RegExp(declared.accepts, 'u').test(value)) return null;
      values[names[index]] = value;
    }
    return values;
  }

  private static pattern(template: string): RegExp {
    let pattern = PluginReadRoutePath.compiled.get(template);
    if (!pattern) {
      const source = template.split(/(:[A-Za-z0-9_]+)/).map((part) => (part.startsWith(':') ? '([^/]+)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
      pattern = new RegExp(`^${source}$`, 'i');
      PluginReadRoutePath.compiled.set(template, pattern);
    }
    return pattern;
  }
}
