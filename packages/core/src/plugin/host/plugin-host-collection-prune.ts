import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { Logger } from '@core/logging';

/**
 * After a plugin's process is replaced, the collections the replaced process registered and the new one
 * did not register again are forgotten.
 *
 * Registering again refreshes a collection in place, but nothing removed one: a release that RETIRED a
 * collection left it registered — on the admin's menu, its list and its CRUD — until the api restarted,
 * and the hot update's schema sync could even create its table again after a migration dropped it.
 *
 * The new process's registrations are applied after the switch; once every one of them has settled,
 * a collection of this plugin that none of them registered is dropped. If any registration failed,
 * nothing is dropped: an incomplete picture must never remove a collection that is still in use.
 */
export class PluginHostCollectionPrune {
  private static readonly REGISTERED_EVENT = 'collection:registered';

  /** Starts watching what the new process registers; call it before applying the new registrations. */
  static watch(manager: IPluginManagerInterface, slug: string, logger: Logger): (applied: unknown[]) => void {
    const registered = new Set<unknown>();
    const listener = (data: any) => { if (data?.pluginSlug === slug && data?.collection) registered.add(data.collection); };
    manager.hooks.on(PluginHostCollectionPrune.REGISTERED_EVENT, listener);
    return (applied) => {
      void Promise.allSettled(applied.map((result) => Promise.resolve(result))).then((results) => {
        manager.hooks.off(PluginHostCollectionPrune.REGISTERED_EVENT, listener);
        if (results.some((result) => result.status === 'rejected')) return;
        for (const [key, entry] of [...manager.registeredCollections]) {
          if (entry.pluginSlug !== slug || registered.has(entry.collection)) continue;
          manager.registeredCollections.delete(key);
          logger.info(`collection "${key}" is no longer registered by "${slug}"; removed`);
        }
      });
    };
  }
}
