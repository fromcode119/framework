import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { LocalizedReadResolver } from '@core/plugin/context/localized-read-resolver';
import { PluginJsonRows } from '@core/plugin/host/plugin-json-rows';

/**
 * How the plugin database proxy answers a plugin PROCESS's `find` with JSON rows (`PluginJsonRows`).
 *
 * The host's dispatcher marks such a `find` with `PluginJsonRows.REQUEST` — a symbol, so it cannot
 * come from a plugin. The proxy takes the mark out of the options first, runs every guard, tenant
 * predicate and archive filter it runs for any `find`, and only then asks the manager's `findAsJson`
 * for the same statement's rows as text. What the JSON path cannot answer runs as `find`.
 *
 * `findAsJson` itself is HOST-ONLY: a plugin calling it directly would skip those guards, so the
 * proxy denies it like any method outside the declared plugin database API.
 */
export class PluginDbJsonFind {
  static readonly HOST_ONLY_METHODS: ReadonlySet<string> = new Set(['findAsJson']);

  /** Whether this `find` was marked by the host — and the mark taken out of `args`' options. */
  static takeRequest(args: any[]): boolean {
    const options = args[1];
    if (!options || typeof options !== 'object' || !(options as any)[PluginJsonRows.REQUEST]) return false;
    const { [PluginJsonRows.REQUEST]: _request, ...rest } = options as Record<string | symbol, unknown>;
    args[1] = rest;
    return true;
  }

  /**
   * `callArgs` (the guarded, scoped, coerced `find` arguments) answered as JSON rows, or — when the JSON
   * path cannot answer — by `find` itself, post-processed as the proxy post-processes every `find`.
   */
  static run(
    db: any,
    callArgs: any[],
    find: () => unknown,
    postProcess: (rows: unknown) => unknown,
    localized: { table: unknown; manager: IPluginManagerInterface } | null,
    omit: readonly string[] = [],
  ): Promise<unknown> {
    return db.findAsJson(callArgs[0], omit.length ? { ...callArgs[1], omit } : callArgs[1]).then((rows: any) => (rows
      ? PluginJsonRows.wrap(rows, localized ? LocalizedReadResolver.resolutionFor(localized.table, localized.manager) : null)
      : Promise.resolve(find()).then(postProcess)));
  }
}
