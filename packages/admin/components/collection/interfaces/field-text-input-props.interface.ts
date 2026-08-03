import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldTextInputProps {
  field: ICollectionField;
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
