import type { IPluginMediaIngestInput } from '@core/plugin/interfaces/plugin-media-ingest-input.interface';

/**
 * The `context.media` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextMedia {
  /**
   * Store a file from a public http(s) url or base64 bytes as a media record; resolves to the record
   * with its `id` and public `url`. Goes through the api's guarded ingest. Needs `content`.
   */
  ingest(input: IPluginMediaIngestInput): Promise<Record<string, unknown>>;
  /**
   * Set a stored file's description (its `alt` text, the name it is shown under) — the one field a plugin
   * may change on a file it did not just ingest, e.g. a migration naming a file a package brought.
   * Resolves to false when the id is not a file of this site. Needs `content`.
   */
  describe(id: any, input: { alt: string }): Promise<boolean>;
  findById(id: any): Promise<Record<string, any> | null>;
  /** Resolve many ids in one statement, keyed by id — the batch form of `findById`. */
  findByIds(ids: any[]): Promise<Map<string, Record<string, any>>>;
  list(options?: { limit?: number; offset?: number }): Promise<Array<Record<string, any>>>;
  count(): Promise<number>;
  /** Where the stored file is served from, or null when it resolves to nothing here or is private. */
  publicUrl(id: any): Promise<string | null>;
  /** SHA-256 (hex) of the stored file's bytes, or null when the id resolves to nothing in this site. */
  digest(id: any): Promise<string | null>;
  /**
   * A stored file's bytes (base64) with its name and type, or null when the id resolves to nothing in
   * this site or the file is over the read limit (the admin upload limit, 25 MB).
   */
  read(id: any): Promise<{ filename: string; mimeType: string; size: number; base64: string } | null>;
}
