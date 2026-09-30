import { RequestContextUtils } from '@core/context/request-context';

/**
 * The key prefix a plugin's cache and redis entries live under: `<kind>:<site>:<plugin>:`.
 *
 * The plugin slug alone was the whole namespace, so one plugin serving many sites wrote every site's
 * entries into the same keys: a value cached for one customer was served to the next site that asked
 * for the same key. The site comes from the request that is running when the key is built — resolved
 * per call, never captured when the context was made — and work outside any request (boot, a
 * scheduler tick) lands in the `platform` space, where no site's request can read it.
 */
export class PluginKeyspace {
  private static readonly PLATFORM = 'platform';

  static prefix(kind: string, pluginSlug: string): string {
    const site = String(RequestContextUtils.getTenantId() ?? '').trim() || PluginKeyspace.PLATFORM;
    return `${kind}:${site}:${pluginSlug}:`;
  }
}
