/** One framework-held dataset, declared so the privacy plugin can register and report on it. */
export interface IPersonalDataDataset {
  key: string;
  label: string;
  fields: string[];
  /** The strategies this dataset can honestly honour. */
  strategies: string[];
  /** Applied when the operator has expressed no preference. Always one of `strategies`. */
  defaultStrategy: string;
}
