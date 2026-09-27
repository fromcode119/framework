import { PluginPathContextProxy } from '@core/plugin/context/paths';

/**
 * `context.paths` inside a plugin process.
 *
 * The process has the plugin's own files, but not the sites' themes: the extension host mounts no
 * theme directory, so every read a theme may override — an email template, a theme-provided default —
 * found no override and returned the plugin's own file. Measured on production: the site's theme ships
 * its own `order-invoice.html`, and the invoice email went out in the plugin's default design.
 *
 * Those reads are answered by the HOST, which holds the themes and resolves the active theme for the
 * site the call is bound to. Reads of the plugin's own files alone stay local.
 */
export class PluginGuestPaths extends PluginPathContextProxy {
  constructor(
    plugin: ConstructorParameters<typeof PluginPathContextProxy>[0],
    manager: ConstructorParameters<typeof PluginPathContextProxy>[1],
    activeThemeSlug: () => Promise<string | null>,
    /** The host's `context.paths` for this plugin, reached over the remote channel. */
    private readonly host: {
      readCurrentPluginText(relativePath: string, options: { pluginDirectory?: string; themeDirectory?: string }): Promise<string>;
      readCurrentPluginJson(relativePath: string, options: { pluginDirectory?: string; themeDirectory?: string }): Promise<Record<string, any>>;
    },
  ) {
    super(plugin, manager, activeThemeSlug);
  }

  override async readCurrentPluginText(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string } = {},
  ): Promise<string> {
    return options.themeDirectory ? this.host.readCurrentPluginText(relativePath, options) : super.readCurrentPluginText(relativePath, options);
  }

  override async readCurrentPluginJson(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string } = {},
  ): Promise<Record<string, any>> {
    return options.themeDirectory ? this.host.readCurrentPluginJson(relativePath, options) : super.readCurrentPluginJson(relativePath, options);
  }
}
