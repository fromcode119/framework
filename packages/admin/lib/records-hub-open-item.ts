import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';

/**
 * The two things you can do with one aggregated record: go to it, or fetch its document.
 *
 * These used to be one method that tried the download FIRST and returned if it worked, so any record
 * carrying a document swallowed the navigation — an invoice row handed you the PDF and the invoice
 * itself could not be opened to edit. They are separate actions now, and the row renders a button
 * for each one the record actually supports.
 *
 * Lives here because two surfaces render the same hub — the Person 360 page and the related-records
 * panel on a collection record — and a second copy of this is a second place to forget that a
 * `downloadUrl` returns base64 rather than a file.
 */
export class RecordsHubOpenItem {
  /** Go to the record's admin page. */
  static open(item: IRecordsHubItem, navigate?: (href: string) => void): void {
    if (!item.href) return;
    if (/^https?:\/\//i.test(item.href)) { window.open(item.href, '_blank', 'noopener'); return; }
    navigate?.(item.href);
  }

  /**
   * Fetch the record's document. Falls back to navigation only when the download could not be
   * handled at all, so a broken document endpoint still leads somewhere useful.
   */
  static async download(item: IRecordsHubItem, navigate?: (href: string) => void): Promise<void> {
    const url = String(item.downloadUrl || '');
    // An ABSOLUTE document url is served by the api directly and is opened, not fetched. This is how
    // an invoice PDF has always been delivered — it used to arrive here as `href` and go through
    // `window.open`. Putting it through the JSON/base64 path instead would break a download that
    // works today, because that endpoint streams a file and answers no base64 envelope.
    if (/^https?:\/\//i.test(url)) { window.open(url, '_blank', 'noopener'); return; }
    if (url && (await RecordsHubOpenItem.fetchDocument(item))) return;
    RecordsHubOpenItem.open(item, navigate);
  }

  /** `false` means "not handled" — the caller falls through to `href`, which is the useful fallback. */
  private static async fetchDocument(item: IRecordsHubItem): Promise<boolean> {
    try {
      const res: any = await AdminApi.get(String(item.downloadUrl));
      const base64 = String(res?.base64 ?? res?.file?.base64 ?? '');
      if (base64) {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: res?.mimeType || 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = String(res?.filename || res?.fileName || `${item.title}.pdf`);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return true;
      }
      if (res?.url) { window.open(String(res.url), '_blank', 'noopener'); return true; }
    } catch { /* fall through to href */ }
    return false;
  }
}
