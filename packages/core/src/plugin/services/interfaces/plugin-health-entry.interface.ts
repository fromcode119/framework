import { PluginHealthBucket } from '@core/plugin/services/enums/plugin-health-bucket.enum';
import { IPluginHealthEntryInput } from '@core/plugin/services/interfaces/plugin-health-entry-input.interface';

export interface IPluginHealthEntry extends IPluginHealthEntryInput {
  addedCapabilities: string[];
  removedCapabilities: string[];
  bucket: PluginHealthBucket;
}
