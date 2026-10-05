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
  /** Where the stored file is served from, or null when it resolves to nothing here or is private. */
  publicUrl(id: any): Promise<string | null>;
  /** SHA-256 (hex) of the stored file's bytes, or null when the id resolves to nothing in this site. */
  digest(id: any): Promise<string | null>;
}
