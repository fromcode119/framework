import type { IPluginHealthEntry } from '@core/plugin/services/interfaces/plugin-health-entry.interface';

export interface IPluginHealthReport {
  ok: boolean;
  counts: { total: number; active: number; held: number; error: number; inactive: number; restartPending: number };
  held: IPluginHealthEntry[];
  error: IPluginHealthEntry[];
  /** Installed newer than running. Not a failure, but the admin is showing the old build until a restart. */
  restartPending: IPluginHealthEntry[];
  entries: IPluginHealthEntry[];
}
