export interface IPluginInstallOperation {
  id: string;
  pluginSlug: string;
  kind: string;
  status: string;
  phase: string;
  message: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  startedAt: string;
  updatedAt: string;
  dependencySlugs: string[];
  migrationNames: string[];
  error?: string;
}