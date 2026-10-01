import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Something one api process changed that every OTHER api process must hear about, because it holds a
 * copy derived from it, or a live event it must pass to its own connections. A signal makes a process
 * forget, re-read or relay — never do the work itself a second time.
 *
 * Carried as a VALUE on the wire: the message crosses a process boundary.
 */
export class ProcessSignal extends Enum {
  /** A settings save: `{ keys, writes }`, as `system:settings:updated` carries it. */
  static readonly SETTINGS_WRITTEN = new ProcessSignal('settings-written');
  /** An explicit cache purge: every site's rendered pages and resolved routes are stale. */
  static readonly CACHE_PURGED = new ProcessSignal('cache-purged');
  /** A write to the sites table: the host map is stale. `{ tenantId }` when one site. */
  static readonly SITES_CHANGED = new ProcessSignal('sites-changed');
  /** Which plugins a site has changed. `{ tenantId }`, none for every site. */
  static readonly PLUGIN_ACCESS_CHANGED = new ProcessSignal('plugin-access-changed');
  /** Which themes a site has changed. `{ tenantId }`, none for every site. */
  static readonly THEME_ACCESS_CHANGED = new ProcessSignal('theme-access-changed');
  /** Something a site's pages are built from changed. `{ tenantId }`, null for every site. */
  static readonly CONTENT_CHANGED = new ProcessSignal('content-changed');
  /**
   * The platform's plugins changed — installed, updated, enabled, disabled, removed or held. `{ slug }`.
   * Every other api process restarts, one at a time, to load them as they are now (ApiWorkerSupervisor).
   */
  static readonly PLUGINS_CHANGED = new ProcessSignal('plugins-changed');
  /** Api 0 stopped a plugin after its process failed (`disableWithError`): `{ slug, message }`. The others mirror it. */
  static readonly PLUGIN_STOPPED = new ProcessSignal('plugin-stopped');
  /** A live event for the admin's sockets: `{ type, payload, plugin, tenantId }`. Each process sends it to its own. */
  static readonly REALTIME_BROADCAST = new ProcessSignal('realtime-broadcast');
  /** A live event for one room's sockets: `{ tenantId, room, data }`. Each process sends it to its own. */
  static readonly REALTIME_ROOM = new ProcessSignal('realtime-room');

  private constructor(value: string) {
    super(value);
  }
}
