/** The dataset facts the policy needs. Satisfied by a framework dataset and a registered source alike. */
export interface IPersonalDataPolicyTarget {
  pluginSlug: string;
  key: string;
  label: string;
  /** ONLY the strategies this dataset can honestly honour. */
  strategies: string[];
  defaultStrategy: string;
}
