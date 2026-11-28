/**
 * The site's email keys. Part of `SystemConstants.META_KEY` — spread into `SystemMetaKeys.ALL` — and
 * split out only for size.
 */
export class EmailMetaKeys {
  static readonly ALL = {
    /**
     * The media id of the logo at the top of every email a site sends — the framework's own (sign-up,
     * password reset, security notices) and any plugin's that places `context.email.logoUrl()`. Blank:
     * no logo. Per SITE, set in Settings → General.
     */
    EMAIL_LOGO: 'email_logo',
    /**
     * How far the site's bounce mailbox has been read (`{ uidValidity, lastUid, readAt, error }`),
     * written by the bounce-reading job and shown on the Emails page. Per SITE; not an operator field —
     * the mailbox itself is set in the site's Email integration.
     */
    EMAIL_BOUNCE_CURSOR: 'email_bounce_cursor',
  } as const;
}
