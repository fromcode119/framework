import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';

/**
 * Opening one aggregated record: download its document, or navigate to its admin page.
 *
 * Lives here because two surfaces render the same hub — the Person 360 page and the related-records
 * panel on a collection record — and a second copy of this is a second place to forget that a
 * `downloadUrl` returns base64 rather than a file.
 */
export class RecordsHubOpenItem {
  static async open(item: IRecordsHubItem, navigate?: (href: string) => void): Promise<void> {
    if (item.downloadUrl && (await RecordsHubOpenItem.download(item))) return;
    if (!item.href) return;
    if (/^https?:\/\//i.test(item.href)) { window.open(item.href, '_blank', 'noopener'); return; }
    navigate?.(item.href);
  }

  /** `false` means "not handled" — the caller falls through to `href`, which is the useful fallback. */
  private static async download(item: IRecordsHubItem): Promise<boolean> {
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
