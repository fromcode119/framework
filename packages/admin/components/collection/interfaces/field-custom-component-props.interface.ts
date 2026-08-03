import { ThemeMode } from '@fromcode119/core/client';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldCustomComponentProps {
  field: ICollectionField;
  currentValue: any;
  updateValue: (value: any) => void;
  theme: ThemeMode;
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  globalSettings?: Record<string, any>;
  fieldComponents: Record<string, any>;
  isFieldReadOnly: boolean;
  record?: Record<string, any>;
  onPatch?: (partial: Record<string, any>) => void;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
}
