import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IEmailCategory } from '@core/email/interfaces/email-category.interface';

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
