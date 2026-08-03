import { ThemeMode } from '@fromcode119/core/client';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldSelectControlProps {
  field: ICollectionField;
  currentValue: any;
  updateValue: (value: any) => void;
  theme: ThemeMode;
  isFieldReadOnly: boolean;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
}
