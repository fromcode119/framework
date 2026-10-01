import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where a notice may be shown. Signed INTO the token, so one minted for a page is never also shown as the
 * site-wide bar on that page, and one minted for the bar cannot be replayed into a page.
 */
export class StorefrontNoticeDisplay extends Enum {
  /** The framework's dismissible bar over whatever page the visitor lands on. */
  static readonly BAR = new StorefrontNoticeDisplay('bar');
  /** A page that renders the notice as its own content (a plugin's confirmation page). */
  static readonly PAGE = new StorefrontNoticeDisplay('page');

  private constructor(value: string) {
    super(value);
  }

  static parse(value: unknown): StorefrontNoticeDisplay | undefined {
    if (value instanceof StorefrontNoticeDisplay) return value;
    return StorefrontNoticeDisplay.fromValue(String(value ?? '').trim().toLowerCase()) as StorefrontNoticeDisplay | undefined;
  }
}
