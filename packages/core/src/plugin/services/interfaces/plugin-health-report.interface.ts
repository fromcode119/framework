import type { IPluginHealthEntry } from '@core/plugin/services/interfaces/plugin-health-entry.interface';

export interface IPluginHealthReport {
  ok: boolean;
  counts: { total: number; active: number; held: number; error: number; inactive: number };
  held: IPluginHealthEntry[];
  error: IPluginHealthEntry[];
  entries: IPluginHealthEntry[];
}
