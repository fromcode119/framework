/**
 * What a plugin hands `context.media.ingest`: the file's name (its extension decides the type the
 * stored bytes are checked against) and exactly one source — a public http(s) url or base64 bytes.
 */
export interface IPluginMediaIngestInput {
  filename: string;
  sourceUrl?: string;
  base64?: string;
  alt?: string;
  /**
   * `MediaVisibility` value. `private` stores the bytes in the private space, which is never served
   * statically: the file has no public url and is handed out only by the plugin's own guarded route
   * (through `read`). Absent reads as public.
   */
  visibility?: string;
}
