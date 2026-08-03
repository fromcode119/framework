import { TextualFieldKind } from '@/components/collection/enums/textual-field-kind.enum';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldTextualControlProps {
  kind: TextualFieldKind;
  field: ICollectionField;
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
