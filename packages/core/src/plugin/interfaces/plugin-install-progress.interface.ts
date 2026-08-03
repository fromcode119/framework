export interface IPluginInstallProgress {
  phase: string;
  message: string;
  pluginSlug: string;
  migrationName?: string;
  dependencySlug?: string;
}
