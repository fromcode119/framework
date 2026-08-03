import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';

export interface ITagFieldProps {
  value: string[] | string;
  onChange: (value: string[] | string) => void;
  placeholder?: string;
  suggestionsLabel?: string;
  theme?: ThemeMode;
  collectionSlug?: string;
  fieldName?: string;
  sourceCollection?: string; // If we want to fetch suggestions from another collection
  sourceField?: string;      // The field in the other collection to suggest from
  hasMany?: boolean;         // Default true, if false it acts as a single select
  allowCreate?: boolean;     // Whether to allow creating new entries in the source collection
  size?: FieldSize;
  apiOverrides?: {
    search?: string;
    suggest?: string;
    create?: string;
  };
}
