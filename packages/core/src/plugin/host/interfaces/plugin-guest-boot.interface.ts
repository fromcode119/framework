/**
 * What the host tells a freshly forked guest, over the channel — never through the environment.
 * The guest's environment is empty on purpose; this message is the only configuration it gets.
 */
export interface IPluginGuestBoot {
  slug: string;
  pluginDir: string;
  entryPath: string;
  manifest: Record<string, unknown>;
  /** Unix socket the guest serves its HTTP routes on; the host proxies requests to it. */
  socketPath: string;
  /** File mode for that socket: 0o600 when host and guest are one user, 0o666 when the directory is the guard. */
  socketMode: number;
  /** `./data/plugins/<slug>`, `rootDir` and the other static facts `context.plugin` exposes. */
  plugin: { slug: string; namespace: string; version: string; dataDir: string; rootDir: string; config: Record<string, unknown> };
  /** Project root, so `ProjectPaths` inside the guest resolves the same tree the host sees. */
  projectRoot: string;
  /** The platform's default locale, for the guest's own translation table (`context.t` is synchronous). */
  defaultLocale: string;
}
