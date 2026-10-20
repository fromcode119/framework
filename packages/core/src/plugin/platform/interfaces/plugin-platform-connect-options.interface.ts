/** What `context.platform.connectUrl` needs besides the platform route. */
export interface IPluginPlatformConnectOptions {
  /**
   * The plugin's own TENANT route that finishes the connection by calling `context.platform.complete`
   * (`connection/complete`, not under `platform/`). The platform part sends the browser there, on the
   * console that asked.
   */
  completePath: string;
  /** Where the browser goes when the connection is done: a path on this site's console. Defaults to '/'. */
  returnTo?: string;
}
