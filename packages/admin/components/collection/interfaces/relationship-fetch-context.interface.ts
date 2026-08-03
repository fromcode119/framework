import type { SelectOption } from '@/components/collection/select-option';

export interface IRelationshipFetchContext {
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
