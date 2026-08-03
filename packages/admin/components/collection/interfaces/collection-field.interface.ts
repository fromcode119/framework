import type { CodeLanguage } from '@fromcode119/core/client';
import { FieldPosition } from '@fromcode119/core/client';

export interface ICollectionField {
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
    position?: FieldPosition;
    description?: string;
    sourceCollection?: string;
    sourceField?: string;
    autofill?: Record<string, string | readonly string[]>;
    language?: CodeLanguage;
    [key: string]: any;
  };
}
