export interface TagFieldProps {
  value: string[] | string;
  onChange: (value: string[] | string) => void;
  placeholder?: string;
  suggestionsLabel?: string;
  theme?: string;
  collectionSlug?: string;
  fieldName?: string;
  sourceCollection?: string; // If we want to fetch suggestions from another collection
  sourceField?: string;      // The field in the other collection to suggest from
  hasMany?: boolean;         // Default true, if false it acts as a single select
  allowCreate?: boolean;     // Whether to allow creating new entries in the source collection
  size?: 'sm' | 'md' | 'lg';
  apiOverrides?: {
    search?: string;
    suggest?: string;
    create?: string;
  };
}

export interface TagOption {
  label: string;
  value: string;
}

export interface TagFieldState {
  inputValue: string;
  suggestions: TagOption[];
  showSuggestions: boolean;
  sourceUnavailableMessage: string;
  labels: Record<string, string>;
  isCreating: boolean;
}

export interface TagFieldSuggestionsProps {
  theme: string;
  inputValue: string;
  suggestions: TagOption[];
  showSuggestions: boolean;
  sourceUnavailableMessage: string;
  sourceCollection?: string;
  suggestionsLabel: string;
  createEntityLabel: string;
  allowCreate: boolean;
  onAdd: (tag: any) => void;
}

export interface TagFieldChipsProps {
  theme: string;
  size: 'sm' | 'md' | 'lg';
  tags: string[];
  labels: Record<string, string>;
  sourceCollection?: string;
  hasMany: boolean;
  isCreating: boolean;
  inputValue: string;
  effectivePlaceholder: string;
  onChange: (value: string[] | string) => void;
  onInputChange: (value: string) => void;
  onShowSuggestions: () => void;
  onAdd: (tag: any) => void;
}
