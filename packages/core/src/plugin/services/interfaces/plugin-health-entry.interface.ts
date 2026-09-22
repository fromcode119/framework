import { PluginHealthBucket } from '@core/plugin/services/enums/plugin-health-bucket.enum';
import { IPluginHealthEntryInput } from '@core/plugin/services/interfaces/plugin-health-entry-input.interface';

export interface IPluginHealthEntry extends IPluginHealthEntryInput {
  addedCapabilities: string[];
  removedCapabilities: string[];
  bucket: PluginHealthBucket;
  /**
   * A newer version is installed than the one being served, and only a restart applies it. The
   * plugin is healthy — it is the SCREEN that is stale — so this is reported alongside the bucket
   * rather than as a bucket of its own.
   */
  restartPending: boolean;
}
