/**
 * The `context.media` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextMedia {
  findById(id: any): Promise<Record<string, any> | null>;
  /** Resolve many ids in one statement, keyed by id — the batch form of `findById`. */
  findByIds(ids: any[]): Promise<Map<string, Record<string, any>>>;
  list(options?: { limit?: number; offset?: number }): Promise<Array<Record<string, any>>>;
  count(): Promise<number>;
}
