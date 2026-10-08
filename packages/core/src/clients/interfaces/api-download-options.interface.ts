/** How a file the api hands out is saved by the browser (`ApiScopeClient.download`). */
export interface IApiDownloadOptions {
  /** The name offered when saving; the response's own `Content-Disposition` name otherwise. */
  filename?: string;
  /** Called as the bytes arrive: how many so far, and how many in all when the server says. */
  onProgress?: (state: { loadedBytes: number; totalBytes: number | null }) => void;
}
