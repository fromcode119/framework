import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { CoercionUtils } from '@core/utils/coercion-utils';

/**
 * Decides whether a site may send through the PLATFORM's mail server.
 *
 * A site that has entered its own SMTP is answered by its own driver and never reaches here. This is
 * only about the site that has entered nothing: it used to inherit the platform's credentials in
 * silence. The read is one row from `_system_meta`, which is tenant-scoped, so the connection's own
 * tenant binding decides whose answer comes back — there is no tenant id to pass and no way to read
 * another site's setting by accident.
 */
export class TenantEmailPolicy {
  private static readonly logger = new Logger({ namespace: 'tenant-email-policy' });

  /** OFF unless the site says otherwise. Absent, unreadable and malformed all mean no. */
  static async permitsPlatformSender(db: any): Promise<boolean> { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const row = await db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK });
      // `toBoolean` is optional-typed; an absent row is a NO, which is the default anyway.
      return CoercionUtils.toBoolean((row as { value?: unknown } | null)?.value) === true;
    } catch (error: unknown) {
      // A failed read is not a permission. Sending through the platform because a query broke is the
      // silent behaviour this whole class exists to remove.
      TenantEmailPolicy.logger.warn(
        `Could not read "${SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK}"; refusing the platform sender. `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
