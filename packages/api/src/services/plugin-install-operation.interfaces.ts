export interface PluginInstallOperationState {
  id: string;
  pluginSlug: string;
  kind: string;
  status: string;
  phase: string;
  message: string;
  startedAt: string;
  updatedAt: string;
  dependencySlugs: string[];
  migrationNames: string[];
  error?: string;
}