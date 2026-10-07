/**
 * What `MediaIngestService.ingest` stores: the bytes come from exactly one of `base64` or
 * `sourceUrl`, and `filename` decides the extension (and so the type the media manager checks the
 * bytes against).
 */
export interface IMediaIngestInput {
  filename: string;
  base64?: string;
  sourceUrl?: string;
  alt?: string;
}
