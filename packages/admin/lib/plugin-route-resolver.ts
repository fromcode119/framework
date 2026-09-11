/**
 * Which plugin a top-level admin path belongs to.
 *
 * The route segment used to BE the slug, so a manifest declaring `menu[].path: "/sources"` for a
 * plugin slugged `build-server` produced "Module Not Found": the admin looked for a plugin called
 * `sources`, and the screen the operator clicked simply did not exist. A slug is an identity — it
 * names tables, slots and the installed record — and a path is a thing people read; forcing them to
 * be the same word means a screen can never be renamed without a migration.
 *
 * The declared path wins, and the slug remains the fallback so every existing plugin resolves
 * exactly as before.
 */
export class PluginRouteResolver {
  static resolveSlug(plugins: Array<Record<string, any>>, segment: string): string {
    const path = `/${String(segment || '').replace(/^\/+/, '')}`;
    const declared = plugins.find((plugin) => PluginRouteResolver.menuPaths(plugin).includes(path));
    return declared ? String(declared.slug) : String(segment || '');
  }

  private static menuPaths(plugin: Record<string, any>): string[] {
    const menu = plugin?.manifest?.admin?.menu ?? plugin?.admin?.menu;
    if (!Array.isArray(menu)) return [];
    return menu
      .map((entry: any) => String(entry?.path || '').trim())
      .filter((entry: string) => entry !== '');
  }
}
