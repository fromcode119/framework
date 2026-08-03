import type { IPluginInstallProgress } from '@core/plugin/interfaces/plugin-install-progress.interface';

export interface IPluginInstallProgressReporter {
  (progress: IPluginInstallProgress): void;
}
