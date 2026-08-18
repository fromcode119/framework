import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { MediaPageController } from '@/app/media/media-page-controller';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';

/** API traffic for sharing files from the Media library. */
export class MediaShareController {
  /**
   * Grants covering ANY of these files, deduplicated.
   *
   * A share can hold several of the selected files, so the same grant comes back once per file it
   * covers; showing it twice would read as two people with access.
   */
  /** One PAGE of shares, newest first — the "what did we send" view the per-file dialog cannot give. */
  static async listShares(offset = 0, limit = 20): Promise<{ shares: any[]; hasMore: boolean }> {
    const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.FILES.SHARES}?limit=${limit}&offset=${offset}`);
    return {
      shares: Array.isArray(response?.data) ? response.data : [],
      hasMore: Boolean(response?.hasMore),
    };
  }

  static async listGrants(shareId: number): Promise<any[]> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.FILES.SHARE_GRANTS(shareId));
    return Array.isArray(response?.data) ? response.data : [];
  }

  static async listGrantsForItems(mediaIds: number[]): Promise<any[]> {
    const byId = new Map<number, any>();

    for (const mediaId of mediaIds) {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.FILES.MEDIA_GRANTS(mediaId));
      for (const grant of Array.isArray(response?.data) ? response.data : []) {
        byId.set(Number(grant.id), grant);
      }
    }

    return [...byId.values()];
  }

  /**
   * Shares a set of files as ONE share, making any public ones private first.
   *
   * The moves happen BEFORE the share is created, so a failure leaves no grant pointing at a file that
   * is still world-readable. The dialog warns about the move up front; nothing here happens silently.
   */
  static async shareFiles(input: {
    items: IMediaItem[];
    title: string;
    recipients: string[];
    message: string;
    expiryDays: number;
    maxDownloads: number;
    requireAccount: boolean;
  }): Promise<{ id: number; failedRecipients: string[] }> {
    for (const item of input.items) {
      if (String(item.visibility || 'public') === 'private') continue;
      await MediaPageController.updateDetails(Number(item.id), item.alt || '', item.caption || '', 'private');
    }

    const response = await AdminApi.post(AdminConstants.ENDPOINTS.FILES.SHARES, {
      title: input.title,
      message: input.message,
      mediaIds: input.items.map((item) => item.id),
      recipients: input.recipients,
      expiryDays: input.expiryDays,
      maxDownloads: input.maxDownloads,
      requireAccount: input.requireAccount,
      requireConfirmation: false,
    });

    return { id: Number(response?.id), failedRecipients: Array.isArray(response?.failedRecipients) ? response.failedRecipients : [] };
  }

  /** Activity in a window — presets or a custom from/to, everything or one share. */
  static async activity(query: { days?: number; from?: string; to?: string; share?: number; eventsOffset?: number }): Promise<any> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.FILES.ACTIVITY(query), { noDedupe: true });
    return response?.data ?? null;
  }

  /** What actually happened to a share — the totals and recent events behind the badges. */
  static async shareActivity(shareId: number): Promise<any> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.FILES.SHARE_ACTIVITY(shareId));
    return response?.data ?? { totals: {}, events: [], downloadCount: 0, openedCount: 0, recipientCount: 0 };
  }

  /**
   * Changes the terms of links that are ALREADY out — a longer deadline, a different allowance.
   *
   * The same URL keeps working; nothing needs re-sending. `expiryDays` is counted from now, which is
   * what an operator means by "give them another week", and `0` means it stops expiring.
   */
  static async updateShare(shareId: number, patch: { title?: string; message?: string; expiryDays?: number; maxDownloads?: number; requireAccount?: boolean }): Promise<number> {
    const response = await AdminApi.patch(AdminConstants.ENDPOINTS.FILES.SHARE(shareId), patch);
    return Number(response?.grantsChanged ?? 0);
  }

  static async updateGrant(grantId: number, patch: { expiryDays?: number; maxDownloads?: number; requireAccount?: boolean }): Promise<void> {
    await AdminApi.patch(AdminConstants.ENDPOINTS.FILES.GRANT(grantId), patch);
  }

  /** Adds people to a share that has already gone out; each gets a link of their own, by email. */
  static async addRecipients(shareId: number, recipients: string[], patch?: { expiryDays?: number; maxDownloads?: number; requireAccount?: boolean }): Promise<string[]> {
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.FILES.SHARE_GRANTS(shareId), { recipients, ...(patch || {}) });
    return Array.isArray(response?.failedRecipients) ? response.failedRecipients : [];
  }

  static async revokeGrant(grantId: number): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.FILES.GRANT(grantId));
  }

  static async revokeShare(shareId: number): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.FILES.SHARE(shareId));
  }

  /**
   * Tags to send-able addresses.
   *
   * A tag can be an address the operator typed or one picked from people, and a pasted tag may itself
   * contain several addresses — so each is split again before validating. Deduped, because picking a
   * person and typing their address should not send twice.
   */
  static normalizeRecipients(tags: string[] | string): string[] {
    const raw = Array.isArray(tags) ? tags : [String(tags || '')];
    const emails = raw
      .flatMap((tag) => String(tag || '').split(/[\n,;\s]+/))
      // A tag may arrive as the display form `Name <email>` rather than the bare value, and splitting
      // on whitespace then leaves `<email>` — which still contains '@', so it would pass validation and
      // be mailed with the angle brackets attached.
      .map((value) => value.trim().replace(/^<|>$/g, '').toLowerCase())
      .filter((value) => MediaShareController.EMAIL.test(value));
    return [...new Set(emails)];
  }

  /** Deliberately loose: the server is the authority, this only keeps obvious non-addresses out. */
  private static readonly EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
}
