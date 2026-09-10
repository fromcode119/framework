import type { ICollection } from '@core/collections/interfaces/collection.interface';

export interface IPluginEntityRegistrationResult {
  collection: ICollection;
  cleanedSlug: boolean;
  physicalSlug: string;
  shortSlug: string;
}
