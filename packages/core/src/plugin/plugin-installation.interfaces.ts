export interface PluginInstallProgress {
  phase: string;
  message: string;
  pluginSlug: string;
  migrationName?: string;
  dependencySlug?: string;
}

export interface PluginInstallProgressReporter {
  (progress: PluginInstallProgress): void;
}