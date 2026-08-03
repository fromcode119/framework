import { ThemeMode } from '@fromcode119/core/client';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldRendererHeaderProps {
  field: ICollectionField;
  label: string;
  theme: ThemeMode;
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
