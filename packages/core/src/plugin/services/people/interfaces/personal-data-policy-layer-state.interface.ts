import type { IPersonalDataChoiceMap } from '@core/plugin/services/people/interfaces/personal-data-choice-map.interface';

/** One resolution layer: what it holds, which layer it is, and how it names itself to an operator. */
export interface IPersonalDataPolicyLayerState {
  stored: IPersonalDataChoiceMap;
  source: string;
  provenance: string;
}
