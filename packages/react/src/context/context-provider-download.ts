import { BrowserFileDownload } from '@fromcode119/core/client';
import type { IApiDownloadOptions } from '@fromcode119/core/client';

/**
 * A file the api hands out, saved by the browser — sent as this surface's own requests are (its
 * client header, its session cookie). A plain link carries neither header, so on a private site the
 * console asking for its own file read as a stranger and was refused.
 */
export class ContextProviderDownload {
  static async run(url: string, clientType: string, options: IApiDownloadOptions = {}): Promise<void> {
    const target = await BrowserFileDownload.target(options.filename || 'download');
    const response = await fetch(url, { credentials: 'include', headers: { 'X-Framework-Client': clientType } });
    if (!response.ok) {
      await target?.writable.abort().catch(() => undefined);
      const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw Object.assign(new Error(payload?.error || `The download failed (${response.status}).`), { statusCode: response.status, data: payload });
    }
    await BrowserFileDownload.save(response, target, options);
  }
}
