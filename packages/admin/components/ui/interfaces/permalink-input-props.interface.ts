import type { ICollection } from '@fromcode119/core/client';

export interface IPermalinkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  slug?: string;
  collection?: ICollection;
  pluginSettings?: Record<string, any>;
}
