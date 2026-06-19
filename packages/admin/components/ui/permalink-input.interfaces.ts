import type { Collection } from '@fromcode119/core/client';

export interface PermalinkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  slug?: string;
  collection?: Collection;
  pluginSettings?: Record<string, any>;
}

export interface PermalinkInputState {
  isEditing: boolean;
  useAbsolutePath: boolean;
}

export interface PermalinkComputed {
  baseUrl: string;
  finalPrefix: string;
  fullDisplayPrefix: string;
  displayValue: string;
  suffix: string;
  isCustomMode: boolean;
  isAbsoluteOverride: boolean;
}
