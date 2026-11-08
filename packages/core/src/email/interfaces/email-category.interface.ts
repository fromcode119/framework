import type { EmailCategoryAudience } from '@core/email/enums/email-category-audience.enum';

/**
 * One opt-outable email stream, as declared by the plugin that sends it.
 *
 * The label and description are i18n KEYS, not text: the sender owns its own copy, and the preferences
 * screen renders whatever the viewer's locale resolves them to. Storing rendered strings here would
 * freeze one language into a framework registry.
 */
export interface IEmailCategory {
  /** The value that appears on the mail and in the suppression list, e.g. `review-invitation`. */
  key: string;
  labelKey: string;
  descriptionKey: string;
  /** Which plugin declared it — for provenance in the admin, never for behaviour. */
  pluginSlug: string;
  /**
   * Who is asked about it. A `person` stream (the default) is mail a customer or member receives and is
   * listed on the account screen. An `admin` stream is an ALERT sent to the site's administrators
   * (`context.notifications.notifyAdmins`) and is listed only to them, in their own profile — a
   * customer is never offered a switch for something they never receive.
   */
  audience?: EmailCategoryAudience;
  /**
   * An alert no one may switch off — one whose silence leaves a site unwatched (a certificate about to
   * expire). It is still LISTED, with its switch held on, so the operator can see it exists and why it
   * cannot be muted. Honoured only for `admin` streams.
   */
  locked?: boolean;
}
