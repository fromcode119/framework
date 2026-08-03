import { ThemeMode } from '@fromcode119/core/client';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldRendererProps {
  field: ICollectionField;
  value: any;
  onChange: (value: any) => void;
  theme: ThemeMode;
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
