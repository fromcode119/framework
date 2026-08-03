import { CollectionKind } from '@core/enums/collection-kind.enum';
import type { IAccess } from '@core/interfaces/access.interface';
import type { IField } from '@core/interfaces/field.interface';

export interface ICollection {
  slug: string;
  pluginSlug?: string; // Automatically populated by framework
  shortSlug?: string;  // Automatically populated by framework
  unprefixedSlug?: string; // Automatically populated by framework (the original plugin-provided slug)
  displayName?: string;
  /**
   * Collection kind. A plugin declares this as a raw literal (`type: 'list' as const`) in its static
   * collection data, and the framework normalizes it with `CollectionKind.resolve()` — so the boundary
   * accepts the string and the resolved value is the Enum. Requiring the Enum here made every plugin
   * collection unassignable while nothing in the framework ever compared against it.
   */
  type?: CollectionKind | string;
  tableName?: string; // Optional: specify a different table name
  primaryKey?: string; // Optional: default is 'id'
  timestamps?: boolean; // Optional: default is true
  versions?: boolean;   // Optional: enable versioning
  workflow?: boolean;   // Optional: enable draft/review/publish workflow
  priority?: number;    // Optional: for sorting in the menu
  system?: boolean;      // Optional: mark as system collection
  fields: IField[];
  indexes?: {
    name?: string;
    fields: string[];
    unique?: boolean;
  }[];
  inputAliases?: {
    field: string;
    from: string[];
  }[];
  derivedFields?: {
    name: string;
    dependsOn?: string[];
    readOnly?: boolean;
  }[];
  api?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  adminLayout?: {
    sections?: {
      name: string;
      label: string;
      description?: string;
    }[];
    tabs?: {
      name: string;
      label: string;
      icon?: string;
    }[];
  };
  access?: {
    create?: IAccess;
    read?: IAccess;
    update?: IAccess;
    delete?: IAccess;
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
