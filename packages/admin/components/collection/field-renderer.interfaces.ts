export interface CollectionField {
  name: string;
  label?: string;
  type: string;
  localized?: boolean;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  relationTo?: string | string[];
  hasMany?: boolean;
  admin?: {
    component?: string;
    handlesLocalization?: boolean;
    readOnly?: boolean;
    hidden?: boolean;
    position?: 'sidebar' | 'main';
    description?: string;
    sourceCollection?: string;
    sourceField?: string;
    autofill?: Record<string, string | readonly string[]>;
    language?: 'javascript' | 'css' | 'html' | 'json' | 'typescript';
    [key: string]: any;
  };
}

export interface FieldRendererProps {
  field: CollectionField;
  value: any;
  onChange: (value: any) => void;
  theme: 'light' | 'dark';
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  globalSettings?: Record<string, any>;
  disabled?: boolean;
  isNew?: boolean;
  errors?: string[];
  slugWarning?: string | null;
  slugManuallyEdited?: boolean;
  readOnlyOverrideGranted?: boolean;
  onReadOnlyOverrideRequest?: (field: { name: string; label: string }) => void;
  /** All current form values — lets a custom component read sibling fields (reactive forms). */
  record?: Record<string, any>;
  /** Update one or more sibling fields at once — the Livewire-style reactive write. */
  onPatch?: (partial: Record<string, any>) => void;
}

export interface FieldLocaleSwitcherProps {
  compact?: boolean;
  theme: 'light' | 'dark';
  activeLocale: string;
  activeLocaleCode: string;
  localeRegistry: Array<{ code: string; label: string }>;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (code: string) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export interface FieldRendererHeaderProps {
  field: CollectionField;
  label: string;
  theme: 'light' | 'dark';
  isFieldReadOnly: boolean;
  supportsReadOnlyOverride: boolean;
  readOnlyOverrideGranted: boolean;
  canRequestReadOnlyOverride: boolean;
  isLocalizedField: boolean;
  componentHandlesLocalization: boolean;
  shouldInlineLocaleSwitcher: boolean;
  onRequestReadOnlyOverride: () => void;
  localeSwitcher: (compact?: boolean) => React.ReactNode;
}

export interface FieldControlRendererProps {
  field: CollectionField;
  currentValue: any;
  resolvedCurrentText: string;
  updateValue: (value: any) => void;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
  theme: 'light' | 'dark';
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  globalSettings?: Record<string, any>;
  fieldComponents: Record<string, any>;
  isFieldReadOnly: boolean;
  isNew: boolean;
  errors?: string[];
  label: string;
  slugWarning?: string | null;
  slugManuallyEdited?: boolean;
  isLocalizedField: boolean;
  shouldInlineLocaleSwitcher: boolean;
  localeSwitcher: (compact?: boolean) => React.ReactNode;
  record?: Record<string, any>;
  onPatch?: (partial: Record<string, any>) => void;
}

export interface FieldCustomComponentProps {
  field: CollectionField;
  currentValue: any;
  updateValue: (value: any) => void;
  theme: 'light' | 'dark';
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  globalSettings?: Record<string, any>;
  fieldComponents: Record<string, any>;
  isFieldReadOnly: boolean;
  record?: Record<string, any>;
  onPatch?: (partial: Record<string, any>) => void;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
}

export interface FieldRendererFooterProps {
  field: CollectionField;
  resolvedFieldDescription: string;
  errors?: string[];
}

export interface FieldSelectControlProps {
  field: CollectionField;
  currentValue: any;
  updateValue: (value: any) => void;
  theme: 'light' | 'dark';
  isFieldReadOnly: boolean;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
}

export interface FieldTextInputProps {
  field: CollectionField;
  currentValue: any;
  resolvedCurrentText: string;
  updateValue: (value: any) => void;
  isFieldReadOnly: boolean;
  isNew: boolean;
  errors?: string[];
  label: string;
  slugWarning?: string | null;
  slugManuallyEdited?: boolean;
  isLocalizedField: boolean;
  shouldInlineLocaleSwitcher: boolean;
  localeSwitcher: (compact?: boolean) => React.ReactNode;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
}

export interface FieldTextualControlProps {
  kind: 'textarea' | 'json' | 'password';
  field: CollectionField;
  currentValue: any;
  resolvedCurrentText: string;
  updateValue: (value: any) => void;
  isFieldReadOnly: boolean;
  errors?: string[];
  label: string;
  isLocalizedField: boolean;
  shouldInlineLocaleSwitcher: boolean;
  localeSwitcher: (compact?: boolean) => React.ReactNode;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
}
