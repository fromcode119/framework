import type { IApiDownloadOptions } from '@core/clients/interfaces/api-download-options.interface';

/**
 * Saves a file the api answered with, in the browser, as it arrives.
 *
 * Where the browser can write to a file the user picks (`showSaveFilePicker`), the bytes go straight
 * there, so a download of hundreds of megabytes never sits in memory. Elsewhere it is collected and
 * offered as a download, as the console's own backups are.
 *
 * The picker must open while the click that asked for the file is still live, so it is asked for
 * FIRST (`target`) and the request is made after; a user who closes it cancels the download.
 */
export class BrowserFileDownload {
  /** Where the bytes will go: a file the user picked, or null when this browser cannot write one. */
  static async target(filename: string): Promise<{ writable: WritableStream<Uint8Array> } | null> {
    const picker = (globalThis as { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }> }).showSaveFilePicker;
    if (!picker) return null;
    const handle = await picker({ suggestedName: filename });
    return { writable: await handle.createWritable() };
  }

  static async save(response: Response, target: { writable: WritableStream<Uint8Array> } | null, options: IApiDownloadOptions = {}): Promise<void> {
    const totalBytes = Number(response.headers.get('content-length')) || null;
    let loadedBytes = 0;
    const counted = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loadedBytes += chunk.byteLength;
        options.onProgress?.({ loadedBytes, totalBytes });
        controller.enqueue(chunk);
      },
    });
    const body = (response.body ?? new Blob([]).stream()).pipeThrough(counted);
    if (target) {
      await body.pipeTo(target.writable);
      return;
    }
    const blob = await new Response(body).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = options.filename || BrowserFileDownload.filenameOf(response) || 'download';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** The name the server gave the file (`Content-Disposition: attachment; filename="…"`). */
  static filenameOf(response: Response): string {
    const header = response.headers.get('content-disposition') || '';
    const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    return match ? decodeURIComponent(match[1]) : '';
  }
}
