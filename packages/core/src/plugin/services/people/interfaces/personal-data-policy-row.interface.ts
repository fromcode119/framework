import type { IPersonalDataStrategyChoice } from '@core/plugin/services/people/interfaces/personal-data-strategy-choice.interface';

/** One dataset and the policy that currently applies to it, for a screen or a pre-run picker. */
export interface IPersonalDataPolicyRow extends IPersonalDataStrategyChoice {
  pluginSlug: string;
  key: string;
  label: string;
  fields: string[];
  /** ONLY the strategies this dataset can honestly honour — what an operator may choose between. */
  strategies: string[];
  defaultStrategy: string;
}
