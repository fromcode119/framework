
import type { IPluginHealthEntry } from '@/app/plugins/health/interfaces/plugin-health-entry.interface';
import type { IPluginHealthCounts } from '@/app/plugins/health/interfaces/plugin-health-counts.interface';

export interface IPluginHealthReport {
  ok: boolean;
  counts: IPluginHealthCounts;
  held: IPluginHealthEntry[];
  error: IPluginHealthEntry[];
  entries: IPluginHealthEntry[];
}
