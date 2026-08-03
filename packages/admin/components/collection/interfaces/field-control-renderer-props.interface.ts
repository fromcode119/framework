import { ThemeMode } from '@fromcode119/core/client';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldControlRendererProps {
  field: ICollectionField;
  currentValue: any;
  resolvedCurrentText: string;
  updateValue: (value: any) => void;
  wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;
  theme: ThemeMode;
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
