import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IEmailCategory } from '@core/email/interfaces/email-category.interface';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { EmailPreferencesTokenService } from '@core/email/email-preferences-token-service';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { SigningSecretService } from '@core/security/signing-secret-service';

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

  static createEmailProxy(plugin: ILoadedPlugin, manager: IPluginManagerInterface): any {
    const driver = (manager as any).integrations?.email;
    const slug = String(plugin?.manifest?.slug || '').trim();

    const additions: Record<string, unknown> = {
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
          const base = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP);
          const path = ApplicationUrlUtils.joinApiPath(base, EmailContextProxy.PREFERENCES_PATH);
          return `${path}?token=${encodeURIComponent(token)}`;
        } catch {
          // No signing key means no link. A mailing without a preferences footer is a smaller problem
          // than one carrying a link that cannot be verified.
          return '';
        }
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
