/**
 * What a file source is handed when the account panel asks it to load.
 *
 * Mirrors the `account.overview.stats` context deliberately: a plugin contributing files and a plugin
 * contributing stat cards should not have to learn two different shapes. `namespace` is the one that
 * matters — a plugin reaches its OWN API through it, which is why the framework can render domain
 * files without naming a single plugin.
 */
export interface IAccountFileSourceContext {
  /** Resolve a plugin namespace, e.g. `context.namespace('<vendor>').<slug>`. */
  namespace: (namespace: string) => any;
  /** The plugin runtime api, for framework-owned requests. */
  api: unknown;
  /** The framework/plugin translator. Every user-facing string a source emits goes through it. */
  t: (key: string, vars?: Record<string, unknown>) => string;
}
