/** What an operator stored for one dataset, at one layer. */
export interface IPersonalDataPolicyChoice {
  strategy: string;
  /** Required by the policy when the strategy is `retain`; ignored otherwise. */
  reason: string;
}
