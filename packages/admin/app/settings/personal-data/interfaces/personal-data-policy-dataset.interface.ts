/** One dataset as the policy endpoint reports it: what it is, and what is in force for it. */
export interface IPersonalDataPolicyDataset {
  /** `<pluginSlug>:<dataset>` — the id every layer stores a choice against. */
  id: string;
  label: string;
  /** The fields this dataset holds, so an operator can see what an erasure reaches. */
  fields: string[];
  /** ONLY the strategies this dataset can honestly honour. */
  strategies: string[];
  /** The strategy that would run right now. */
  strategy: string;
  reason: string;
  /** Where that strategy came from, in the words the operator is shown. */
  provenance: string;
  /** What the declaring plugin falls back to, named — so an empty platform cell can say so. */
  declaredProvenance: string;
  /** Set when a stored choice could not be honoured, so the operator is told rather than overridden. */
  problem: string;
}
