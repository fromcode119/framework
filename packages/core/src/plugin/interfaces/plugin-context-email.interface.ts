import type { IEmailDriver } from '@fromcode119/email';
import type { IEmailCategory } from '@core/email/interfaces/email-category.interface';
import type { IPluginContextEmailInbox } from '@core/plugin/interfaces/plugin-context-email-inbox.interface';

/**
 * What a plugin's `context.email` actually is: the platform mailer (`send`), the do-not-email list the
 * suppressing driver exposes, and the additions `EmailContextProxy` puts in front of it.
 *
 * It was declared as the bare `IEmailDriver`, whose contract is `send` alone — so every plugin calling
 * `logoUrl`, `isSuppressed`, `registerCategory` or `buildPreferencesUrl` (all real, all documented) was
 * reported as a type error, and those errors made up part of every plugin's type-check baseline.
 */
export interface IPluginContextEmail extends IEmailDriver {
  /** True when the address opted out of this category (or of all mail). */
  isSuppressed(address: string, category?: string): Promise<boolean>;
  suppress(address: string, category?: string, source?: string): Promise<void>;
  unsuppress(address: string, category?: string): Promise<void>;
  /** Declare an opt-outable stream this plugin sends; call in `onInit`. */
  registerCategory(category: Omit<IEmailCategory, 'pluginSlug'>): void;
  listCategories(): IEmailCategory[];
  /** The signed preferences/unsubscribe link for one address on this site; '' when it cannot be built. */
  buildPreferencesUrl(address: string): Promise<string>;
  /** The site's email logo as an absolute URL, or '' when the site has none. */
  logoUrl(): Promise<string>;
  /** Read new mail from an IMAP mailbox; needs the `network` capability as well as `email`. */
  inbox: IPluginContextEmailInbox;
}
