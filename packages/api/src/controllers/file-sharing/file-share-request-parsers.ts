
/**
 * Parsing the request payloads the file-share admin surfaces accept.
 *
 * Its own file because BOTH FileShareAdminController and FileGrantAdminController parse these — keeping
 * them on either controller would have made one import the other (2026-09-09 split).
 */
export class FileShareRequestParsers {

  /**
   * The grant fields an edit may carry. Absent means "leave alone" — never "reset to the default",
   * which would silently shorten a deadline the operator had extended.
   */
  static readGrantPatch(body: any): { expiresAt?: string | null; maxDownloads?: number; requireConfirmation?: boolean; requireAccount?: boolean } {
    const patch: { expiresAt?: string | null; maxDownloads?: number; requireConfirmation?: boolean; requireAccount?: boolean } = {};

    if (body?.expiryDays !== undefined) {
      const days = Number(body.expiryDays);
      patch.expiresAt = !Number.isFinite(days) || days <= 0 ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else if (body?.expiresAt !== undefined) {
      patch.expiresAt = body.expiresAt === null || body.expiresAt === '' ? null : String(body.expiresAt);
    }

    if (body?.maxDownloads !== undefined) patch.maxDownloads = Number(body.maxDownloads);
    if (body?.requireConfirmation !== undefined) patch.requireConfirmation = Boolean(body.requireConfirmation);
    if (body?.requireAccount !== undefined) patch.requireAccount = Boolean(body.requireAccount);
    return patch;
  }



  /** A corrupt list yields no match rather than throwing — one bad row must not break the dialog. */
  static parseMediaIds(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    try {
      const parsed = JSON.parse(String(value ?? '[]'));
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }
}
