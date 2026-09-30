import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Something one api process changed that every OTHER api process must hear about, because it holds a
 * copy derived from it. Invalidation only: a signal makes a process forget or re-read, never act.
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

  private constructor(value: string) {
    super(value);
  }
}
