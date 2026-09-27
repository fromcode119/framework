/** What a site may do with plugins of its own, as the api states it. */
export interface ISitePluginQuota {
  /** The platform allows sites to upload their own plugins. */
  enabled: boolean;
  /** This server can run a plugin under its own user — without it, a site's plugin is not accepted. */
  isolated: boolean;
  maxBytes: number;
  maxPlugins: number;
  usedBytes: number;
  plugins: number;
}
