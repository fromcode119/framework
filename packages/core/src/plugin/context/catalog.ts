import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { CoreServices } from '@core/services/core-services';

/**
 * Plugin-facing facade over the catalogue contribution registry.
 *
 * A plugin that produces installable packages — one that builds them from git, say — offers them
 * here, and they appear wherever the marketplace catalogue already appears: the update counter on
 * the Plugins screen, the "update available" badge, the update action. Nothing downstream learns a
 * new concept, and an installation with no marketplace stops answering "0 updates" to a question it
 * was never able to answer.
 *
 * `list` is called whenever the catalogue is read, so it must be cheap: a query over what has
 * already been produced, never a call out to a git host.
 */
export class CatalogContextProxy {
  static createCatalogProxy(plugin: ILoadedPlugin) {
    const namespace = String(plugin?.manifest?.namespace || '').trim();
    const pluginSlug = String(plugin?.manifest?.slug || '').trim();

    return {
      /**
       * Offers versions, and optionally says where one of them IS.
       *
       * `resolveArtifact` exists because a contributed offer is a file this installation produced,
       * while the catalogue shape it borrows only carries `downloadUrl` — so an installer resolved
       * a bare filename against the remote marketplace and fetched a package that was never there.
       * A contributor that hosts nothing omits it; the installer then says so rather than guessing.
       */
      contribute(
        list: () => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>,
        resolveArtifact?: (slug: string, kind: string) => Promise<string | null> | string | null,
      ) {
        CoreServices.getInstance().catalogContributions.register({
          namespace,
          pluginSlug,
          list,
          resolveArtifact,
        });
      },

      withdraw() {
        CoreServices.getInstance().catalogContributions.unregisterByPlugin(namespace, pluginSlug);
      },
    };
  }
}
