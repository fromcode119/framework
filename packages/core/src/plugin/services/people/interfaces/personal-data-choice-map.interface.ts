import type { IPersonalDataStoredChoice } from '@core/plugin/services/people/interfaces/personal-data-stored-choice.interface';

/**
 * Stored choices, keyed `<pluginSlug>:<dataset>` — one layer's worth.
 *
 * The same shape at every layer and in every store, which is what makes the handoff between them a
 * copy rather than a translation.
 */
export interface IPersonalDataChoiceMap {
  [id: string]: IPersonalDataStoredChoice;
}
