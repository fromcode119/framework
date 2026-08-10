import { SystemConstants } from '@core/constants/system.constants';

/**
 * The install's do-not-email list, owned by the framework.
 *
 * Any extension may send mail. Each one growing its own opt-out list means a person who says "stop
 * emailing me" is honoured only by whichever sender they happened to click, and the operator has as
 * many lists to check as there are senders. So the list lives here and is enforced at the send layer —
 * a sender cannot forget to check something it never gets the chance to skip.
 *
 * ## Categories
 *
 * A blunt list would be its own bug: unsubscribing from review invitations must not silence an order
 * confirmation. So a suppression names a STREAM.
 *
 *  - `ALL` — the hard "stop emailing me". Blocks every message, transactional included.
 *  - any other value — blocks just that stream, named by whoever sends it.
 *
 * Mail sent with NO category is transactional, and only an `ALL` row stops it. That default is
 * deliberate: a sender that forgets to label its marketing mail sends it, which is a visible mistake,
 * whereas a default of "suppress unless labelled" would silently swallow receipts and be noticed only
 * when a customer complains their invoice never arrived.
 */
export class EmailSuppressionService {
  /** Suppresses EVERY message to the address, transactional included. */
  static readonly ALL = 'all';

  private static normalizeAddress(address: unknown): string {
    return String(address ?? '').trim().toLowerCase();
  }

  private static normalizeCategory(category: unknown): string {
    return String(category ?? '').trim().toLowerCase() || EmailSuppressionService.ALL;
  }

  /**
   * Whether `address` may be sent a message of `category`. An unreadable table answers "not
   * suppressed": failing to send everything because a query broke is a worse failure than sending one
   * message to someone who opted out, and the alternative is an install whose email silently stops.
   */
  static async isSuppressed(db: any, address: unknown, category?: unknown): Promise<boolean> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const normalizedAddress = EmailSuppressionService.normalizeAddress(address);
    if (!normalizedAddress) return false;

    const rows = await db
      .find(SystemConstants.TABLE.EMAIL_SUPPRESSIONS, { where: { address: normalizedAddress }, limit: 100 })
      .catch(() => []);

    const requested = String(category ?? '').trim().toLowerCase();
    for (const row of Array.isArray(rows) ? rows : []) {
      const suppressed = EmailSuppressionService.normalizeCategory((row as any)?.category); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (suppressed === EmailSuppressionService.ALL) return true;
      if (requested && suppressed === requested) return true;
    }
    return false;
  }

  /** Idempotent — recording the same opt-out twice is a second success, not a duplicate row. */
  static async suppress(db: any, address: unknown, category?: unknown, source?: unknown): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const normalizedAddress = EmailSuppressionService.normalizeAddress(address);
    if (!normalizedAddress) return;
    const normalizedCategory = EmailSuppressionService.normalizeCategory(category);

    const existing = await db
      .find(SystemConstants.TABLE.EMAIL_SUPPRESSIONS, { where: { address: normalizedAddress, category: normalizedCategory }, limit: 1 })
      .catch(() => []);
    if ((Array.isArray(existing) ? existing : []).length) return;

    await db.insert(SystemConstants.TABLE.EMAIL_SUPPRESSIONS, {
      address: normalizedAddress,
      category: normalizedCategory,
      source: String(source ?? '').trim(),
      createdAt: new Date().toISOString(),
    });
  }

  /** Removes one suppression. Re-subscribing is an operator/recipient action, never automatic. */
  static async unsuppress(db: any, address: unknown, category?: unknown): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const normalizedAddress = EmailSuppressionService.normalizeAddress(address);
    if (!normalizedAddress) return;
    await db
      .delete(SystemConstants.TABLE.EMAIL_SUPPRESSIONS, {
        address: normalizedAddress,
        category: EmailSuppressionService.normalizeCategory(category),
      })
      .catch(() => undefined);
  }
}
