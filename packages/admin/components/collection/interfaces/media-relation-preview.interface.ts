export interface IMediaRelationPreview {
  /** The stored selection this preview shows: a media id, or a theme asset ("theme:<relativePath>"). */
  id?: string;
  url?: string;
  filename?: string;
  /** What the file is, so an image previews as one and a PDF as a named file — never a broken image. */
  mimeType?: string;
}
