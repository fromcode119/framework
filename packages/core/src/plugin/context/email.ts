import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IEmailCategory } from '@core/email/interfaces/email-category.interface';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { EmailPreferencesTokenService } from '@core/email/email-preferences-token-service';
import { EmailLogoUrl } from '@core/email/email-logo-url';
import { SystemConstants } from '@core/constants/system.constants';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { SigningSecretService } from '@core/security/signing-secret-service';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { PluginInbox } from '@core/email/plugin-inbox';
import type { IInboxAccount, IInboxFetchOptions } from '@fromcode119/email';

/**
 * `context.email` — the mail driver, plus the ability to DECLARE an opt-outable stream.
 *
 * This used to hand back `manager.integrations.email` directly, which is a transport: it can send, and
 * it can suppress an address, but it has no idea what streams exist. `registerCategory` is what turns a
 * private string constant (`'review-invitation'`) into something a preferences screen can enumerate and
 * name, without that screen having to know which plugins exist.
 *
 * Everything else forwards to the driver untouched, so `send`, `suppress`, `unsuppress` and
 * `isSuppressed` keep working exactly as before — the Proxy adds, it does not wrap behaviour.
 */
export class EmailContextProxy {
  /** The framework-owned preferences page. Kept here so no plugin hardcodes the path. */
  private static readonly PREFERENCES_PATH = '/unsubscribe';

  /**
   * `activeThemeSlug` is the plugin's own `paths.resolveActiveThemeSlug` — the theme this request's
   * site renders with, answered the same way wherever the plugin runs.
   */
  static createEmailProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    activeThemeSlug: () => Promise<string | null>,
    /** The same gate `context.fetch` passes: the `network` capability and the site's environment. */
    assertNetwork: (target: string) => Promise<void> = async () => { throw new Error('network is not available here'); },
  ): any {
    const driver = (manager as any).integrations?.email;
    const slug = String(plugin?.manifest?.slug || '').trim();

    const additions: Record<string, unknown> = {
      /**
       * Re-subscribe an address to a stream THIS plugin declared — after the person opted back in.
       *
       * Forwarded untouched, as it was, any plugin could lift any opt-out — every other plugin's stream,
       * or with no category the address's global one — and mail people who had unsubscribed.
       */
      unsuppress: async (address: string, category?: string) => {
        const key = String(category ?? '').trim();
        if (!key || (manager as any).emailCategories?.ownerOf(key) !== slug) {
          throw new Error(`context.email.unsuppress refused: "${key || '(all mail)'}" is not a stream plugin "${slug}" declared.`);
        }
        return driver.unsuppress(address, key);
      },
      /**
       * Read new mail from an IMAP mailbox (a helpdesk's support address). The plugin keeps the account
       * and the last UID it has seen; the host connects — public addresses and IMAP ports only — and
       * hands back the messages. See {@link PluginInbox}.
       */
      inbox: {
        fetch: (account: IInboxAccount, options?: IInboxFetchOptions) => PluginInbox.fetch(account, options ?? {}, assertNetwork),
      },
      /**
       * Declare a stream this plugin sends that a person may switch off. Call it in `onInit` — the
       * registry is in-memory, so it is rebuilt on every boot from whatever is actually installed and
       * cannot drift into listing a stream from an uninstalled plugin.
       */
      registerCategory: (category: Omit<IEmailCategory, 'pluginSlug'>) => {
        (manager as any).emailCategories?.register({ ...category, pluginSlug: slug });
      },
      /** Every declared stream. The account preferences screen is the caller that matters. */
      listCategories: (): IEmailCategory[] => (manager as any).emailCategories?.list() ?? [],

      /**
       * The global preferences link for one address — what a mailing puts in its footer and its
       * `List-Unsubscribe` header.
       *
       * The FRAMEWORK mints it, not the plugin, and that is the whole point. The token is signed with
       * the install's root secret; handing plugins the ability to mint one would mean any plugin could
       * forge a link for any address. A plugin supplies the address and gets back a URL, exactly as it
       * supplies a message to `notifications.notifyAdmins` and never resolves recipients itself.
       *
       * Returns `''` when the frontend URL is not configured or no signing key can be resolved — an
       * empty string, never a guessed host and never an unsigned link. Callers omit the footer.
       */
      buildPreferencesUrl: async (address: string): Promise<string> => {
        const normalized = String(address || '').trim();
        if (!normalized) return '';
        try {
          const secret = await SigningSecretService.signingKey(
            MetaContextProxy.createMetaProxy(manager),
            EmailPreferencesTokenService.PURPOSE,
          );
          const token = EmailPreferencesTokenService.generate(normalized, secret);
          // THIS SITE's frontend: the platform host carries no tenant, so the page would 404 there.
          const base = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
          const path = ApplicationUrlUtils.joinApiPath(base, EmailContextProxy.PREFERENCES_PATH);
          return `${path}?token=${encodeURIComponent(token)}`;
        } catch {
          // No signing key means no link. A mailing without a preferences footer is a smaller problem
          // than one carrying a link that cannot be verified.
          return '';
        }
      },

      /**
       * The site's email logo (Settings → General → Email logo) as an absolute URL on the site's own
       * host, for the top of the plugin's HTML template — or `''` when the site has none, in which case
       * the template shows no logo. The same logo the framework's own emails carry, so a site's mail is
       * branded once, not once per plugin.
       */
      logoUrl: async (): Promise<string> => {
        const setting = await MetaContextProxy.createMetaProxy(manager).get(SystemConstants.META_KEY.EMAIL_LOGO);
        return EmailLogoUrl.resolve(manager.db, setting, activeThemeSlug);
      },
    };

    return new Proxy(driver ?? {}, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && prop in additions) return additions[prop];
        const value = Reflect.get(target, prop, receiver);
        // Methods must keep their `this` — the driver holds the db handle the suppression list uses.
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }
}
