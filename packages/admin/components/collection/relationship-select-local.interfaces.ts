export interface RelationshipSelectLocalProps {
  field: any;
  value: any;
  onChange: (val: any) => void;
  theme: string;
  /** All current form values — lets autofill avoid clobbering existing siblings if needed. */
  record?: Record<string, any>;
  /** Patch sibling fields live when a related record is picked (schema `admin.autofill`). */
  onPatch?: (partial: Record<string, any>) => void;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface RelationshipSelectLocalState {
  search: string;
  options: SelectOption[];
}

export interface RelationshipFetchContext {
  field: any;
  value: any;
  api: any;
  collections: any[];
  sourceCollectionSlugs: string[];
  isMultiSource: boolean;
  currentTarget: any;
  currentValue: any;
  currentSelectValue: string;
  search: string;
  docByKey: Record<string, any>;
  rawValueMap: Record<string, any>;
  disposed: () => boolean;
  setOptions: (options: SelectOption[]) => void;
  upsertOption: (option: SelectOption) => void;
}
