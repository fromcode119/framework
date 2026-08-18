/**
 * One recipient's access to a file share, as loaded from `_system_file_grants`.
 *
 * Dates are `Date | string | null` because the dialects disagree: postgres returns a `Date` for a
 * TIMESTAMP column while SQLite returns the stored TEXT. Consumers must not assume either — that is why
 * `GrantTokenService.evaluate` normalises before comparing rather than trusting the shape.
 */
export interface IFileGrantRecord {
  id: number;
  shareId: number;
  email: string;
  userId: number | null;
  /** sha256 of the raw token. The raw value is not stored and cannot be derived from this. */
  tokenHash: string;
  /** Null means never expires. */
  expiresAt: Date | string | null;
  /** 0 (or any non-positive value) means unlimited. */
  maxDownloads: number;
  downloadCount: number;
  requireConfirmation: boolean;
  requireAccount: boolean;
  revokedAt: Date | string | null;
  lastAccessAt: Date | string | null;
  lastAccessIp: string | null;
}
