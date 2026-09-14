/** Who a framework-side erasure is about. Mirrors the privacy plugin's subject reference. */
export interface IPersonalDataSubject {
  email: string;
  personId?: string | number | null;
  userId?: string | number | null;
}

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

/** What a framework dataset did. See the privacy plugin's contract for what each number means. */
export interface IPersonalDataErasure {
  strategy: string;
  erased: number;
  anonymised: number;
  retained: number;
  remaining: number;
  retainedReason?: string;
}
