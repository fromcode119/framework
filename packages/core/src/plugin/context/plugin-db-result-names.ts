import { NamingStrategy } from '@fromcode119/database';

/**
 * Names in what `context.db` hands plugin code, as plugin code names them: camelCase, one name per
 * field — the dialects return the columns as they are stored (`source_id`).
 *
 * Rows of a table, and results keyed by COLUMN rather than rows (`groupCount`): a plugin grouping by
 * `sourceId` reads `group.sourceId`. Grouped counts used to come back as stored, so a plugin that read
 * the name it had asked for read nothing, with no error.
 */
export class PluginDbResultNames {
  private static readonly KEYED_RESULT_METHODS = new Set(['groupCount']);

  static denormalize(result: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (result == null) return result;
    if (Array.isArray(result)) return result.map((row) => NamingStrategy.denormalizeRecord(row));
    return NamingStrategy.denormalizeRecord(result);
  }

  /** Whether `method` answers with column-keyed results that are named, and nothing else of a row's handling. */
  static isKeyed(method: string): boolean {
    return PluginDbResultNames.KEYED_RESULT_METHODS.has(method);
  }

  /** The column-keyed result, named — awaited when the driver answered with a promise. */
  static keyed(out: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return out && typeof out.then === 'function' ? out.then(PluginDbResultNames.denormalize) : PluginDbResultNames.denormalize(out);
  }
}
