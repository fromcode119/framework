import type { Collection } from '../../types/schema.interfaces';

export interface PluginEntityRegistrationResult {
  collection: Collection;
  cleanedSlug: boolean;
  physicalSlug: string;
  shortSlug: string;
}
