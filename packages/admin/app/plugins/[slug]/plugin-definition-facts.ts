import type { ILoadedPlugin } from '@fromcode119/core/client';
import type { IAdminFact } from '@/components/ui/interfaces/admin-fact.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The at-a-glance half of a plugin's definition: what its manifest says about it, as labelled values.
 *
 * Only what the manifest actually declares is listed. A field it leaves out is left out here, never
 * filled with a stand-in, so the panel cannot say anything the plugin did not.
 */
export class PluginDefinitionFacts {
  static identity(plugin: ILoadedPlugin): IAdminFact[] {
    const manifest = plugin.manifest;
    return PluginDefinitionFacts.present([
      ['name', 'plugins.detail.definition.name', manifest.name],
      ['vendor', 'plugins.detail.definition.vendor', manifest.namespace],
      ['slug', 'plugins.detail.definition.slug', manifest.slug],
      ['version', 'plugins.detail.definition.version', manifest.version],
      ['author', 'plugins.detail.definition.author', PluginDefinitionFacts.author(manifest.author)],
      ['category', 'plugins.detail.definition.category', manifest.category],
      ['license', 'plugins.detail.definition.license', manifest.license],
      ['homepage', 'plugins.detail.definition.homepage', manifest.homepage, true],
      ['repository', 'plugins.detail.definition.repository', manifest.repository, true],
      ['description', 'plugins.detail.definition.description', manifest.description, true],
    ]);
  }

  /** What the platform recorded when the plugin failed to start, as opposed to what the manifest declares. */
  static runtime(plugin: ILoadedPlugin): IAdminFact[] {
    return PluginDefinitionFacts.present([
      ['error', 'plugins.detail.definition.errorMessage', plugin.error, true],
    ]);
  }

  /** Where the plugin shows up outside the console, and who it may call. */
  static reach(plugin: ILoadedPlugin): IAdminFact[] {
    const manifest = plugin.manifest;
    const routes = (manifest.ui?.publicRoutes ?? []).map((route, index) =>
      [`route-${index}`, 'plugins.detail.definition.publicAddress', `/${String(route.path).replace(/^\/+/, '')}`] as const);
    const network = manifest.network;
    const hosts = network?.any ? AdminI18n.t('plugins.detail.definition.anyHost') : (network?.hosts ?? []).join(', ');
    const needs = Object.entries(manifest.dependencies ?? {}).map(([slug, range]) => `${slug} ${range}`).join(', ');
    return PluginDefinitionFacts.present([
      ...routes,
      ['hosts', 'plugins.detail.definition.hosts', hosts, true],
      ['needs', 'plugins.detail.definition.needs', needs, true],
    ]);
  }

  /** Each declared capability, and whether an operator has approved it. */
  static capabilities(plugin: ILoadedPlugin): Array<{ name: string; approved: boolean }> {
    const approved = new Set(plugin.approvedCapabilities ?? []);
    return (plugin.manifest.capabilities ?? []).map((name) => ({ name, approved: approved.has(name) }));
  }

  /** The manifest allows a bare name or `{ name, email, url }`; a string has no `name`, so it falls through. */
  private static author(value: unknown): string {
    return (value as { name?: string } | undefined)?.name ?? String(value ?? '');
  }

  private static present(rows: ReadonlyArray<readonly [string, string, unknown, boolean?]>): IAdminFact[] {
    return rows
      .filter(([, , value]) => String(value ?? '').trim() !== '')
      .map(([key, label, value, wide]) => ({ key, label: AdminI18n.t(label), value: String(value), wide: Boolean(wide) }));
  }
}
