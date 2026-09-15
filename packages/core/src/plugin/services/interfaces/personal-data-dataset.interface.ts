/** One framework-held dataset, declared so a compliance plugin can report on it without naming a table. */
export interface IPersonalDataDataset {
  key: string;
  label: string;
  fields: string[];
  /** The strategies this dataset can honestly honour. */
  strategies: string[];
  /** Applied when the operator has expressed no preference. Always one of `strategies`. */
  defaultStrategy: string;
}
