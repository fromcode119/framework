import type { IPersonalDataPolicyChoice } from '@/app/settings/personal-data/interfaces/personal-data-policy-choice.interface';

/**
 * One layer's stored choices, keyed `<pluginSlug>:<dataset>`.
 *
 * The same shape the server stores and the same shape it returns, so the page never translates
 * between two spellings of the operator's own decision.
 */
export interface IPersonalDataChoiceMap {
  [id: string]: IPersonalDataPolicyChoice;
}
