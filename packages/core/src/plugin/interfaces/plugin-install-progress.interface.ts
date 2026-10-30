export interface IPluginInstallProgress {
  phase: string;
  message: string;
  /** The console words `message` from `plugins.installProgress.<messageKey>`; `message` stays the log's English. */
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  pluginSlug: string;
  migrationName?: string;
  dependencySlug?: string;
}
