import { FieldType } from './enums.enums';
import type { Access } from './schema.types';

export interface Field {
  name: string;
  type: FieldType;
  label?: string;
  localized?: boolean;
  required?: boolean;
  unique?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[]; // For select type
  relationTo?: string; // For relationship/upload type
  hasMany?: boolean; // For relationship
  min?: number; // For number
  max?: number; // For number
  minLength?: number; // For text
  maxLength?: number; // For text
  language?: 'javascript' | 'css' | 'html' | 'json' | 'typescript'; // For code
  showTime?: boolean; // For date/datetime
  fields?: Field[]; // For array/group fields
  admin?: {
    hidden?: boolean;
    readOnly?: boolean;
    description?: string;
    position?: 'sidebar' | 'main';
    component?: string;
    handlesLocalization?: boolean;
    width?: 'full' | 'half';
    condition?: {
      field: string;
      operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan' | 'exists' | 'notExists';
      value?: any;
    };
    tab?: string;
    section?: string;
  };
}

export interface SettingsTab {
  id: string;
  label: string;
  icon?: string;
  fields: string[]; // Field names
}

export interface PluginSettingsSchema {
  fields: Field[];
  tabs?: SettingsTab[];
  
  // Optional validation function
  validate?: (
    values: Record<string, any>,
    context: any // Use any to avoid circular dependency
  ) => Promise<Record<string, string> | null>;
  
  // Optional save hook
  onSave?: (
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    context: any // Use any to avoid circular dependency
  ) => Promise<void>;
}

export interface Collection {
  slug: string;
  pluginSlug?: string; // Automatically populated by framework
  shortSlug?: string;  // Automatically populated by framework
  unprefixedSlug?: string; // Automatically populated by framework (the original plugin-provided slug)
  displayName?: string;
  type?: 'list' | 'global' | 'singleton'; // Collection type
  tableName?: string; // Optional: specify a different table name
  primaryKey?: string; // Optional: default is 'id'
  timestamps?: boolean; // Optional: default is true
  versions?: boolean;   // Optional: enable versioning
  workflow?: boolean;   // Optional: enable draft/review/publish workflow
  priority?: number;    // Optional: for sorting in the menu
  system?: boolean;      // Optional: mark as system collection
  fields: Field[];
  access?: {
    create?: Access;
    read?: Access;
    update?: Access;
    delete?: Access;
  };
  hooks?: {
    beforeChange?: any[];
    afterChange?: any[];
    beforeDelete?: any[];
    afterDelete?: any[];
  };
  admin?: {
    useAsTitle?: string;
    defaultColumns?: string[];
    group?: string;
    icon?: string;
    hidden?: boolean | ((args: { user: any }) => boolean);
    priority?: number;
    tabs?: {
      name: string;
      label: string;
      icon?: string;
    }[];
    sections?: {
      name: string;
      label: string;
      description?: string;
    }[];
    previewPrefixSettingsKey?: string;
  };
}

export interface CollectionQueryInterface {
  find(options?: any): Promise<any[]>;
  findOne(where: any): Promise<any | null>;
  insert(data: any): Promise<any>;
  update(where: any, data: any): Promise<any>;
  delete(where: any): Promise<boolean>;
  count(where?: any): Promise<number>;
}
