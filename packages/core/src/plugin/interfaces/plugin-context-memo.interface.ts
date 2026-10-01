/**
 * Answers a plugin may keep instead of working them out on every request — a configuration it derives
 * from its settings and tables, another plugin's pricing setup.
 *
 * `forSite(key, compute)` runs `compute` once for the current site and keeps the answer until anything
 * on that site changes (a settings save, a table write, a content edit) and never longer than the
 * operator's maximum age (Settings → Infrastructure → API response cache; 0 keeps nothing). Only for
 * answers that depend on the site's own state: never one that depends on who is asking, the time, or
 * the request. Each caller receives its own copy.
 */
export interface IPluginContextMemo {
  forSite<T>(key: string, compute: () => T | Promise<T>): Promise<T>;
}
