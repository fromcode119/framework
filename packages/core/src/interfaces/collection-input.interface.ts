import type { ICollection } from '@core/interfaces/collection.interface';
import type { IFieldInput } from '@core/interfaces/field-input.interface';

/**
 * A collection as a PLUGIN declares it, before the framework normalizes it.
 *
 * This replaces the old `DeepReadonly<T>` recursive mapped type. The insight that made a plain interface
 * possible: TypeScript ignores `readonly` PROPERTY modifiers when checking assignability, so a deeply
 * frozen `as const` literal already assigns to a mutable shape — the ONLY thing that ever failed was
 * `readonly T[]` → `T[]`. So the input type does not need to transform every property at every depth; it
 * only needs each ARRAY container marked readonly. An earlier attempt (`extends Omit<ICollection,'fields'>`)
 * produced ~99 errors because it made only the TOP-level array readonly and left the nested ones mutable.
 *
 * The framework never mutates this: `PluginEntityRegistrationService.normalizeForPlugin` clones fields,
 * hooks and admin into a fresh mutable {@link ICollection}, which is what the rest of the system uses.
 */
export interface ICollectionInput extends Omit<
  ICollection,
  'fields' | 'indexes' | 'inputAliases' | 'derivedFields' | 'adminLayout' | 'hooks' | 'admin'
> {
  readonly fields: readonly IFieldInput[];

  readonly indexes?: readonly {
    readonly name?: string;
    readonly fields: readonly string[];
    readonly unique?: boolean;
  }[];

  readonly inputAliases?: readonly {
    readonly field: string;
    readonly from: readonly string[];
  }[];

  readonly derivedFields?: readonly {
    readonly name: string;
    readonly dependsOn?: readonly string[];
    readonly readOnly?: boolean;
  }[];

  readonly adminLayout?: {
    readonly sections?: readonly {
      readonly name: string;
      readonly label: string;
      readonly description?: string;
    }[];
    readonly tabs?: readonly {
      readonly name: string;
      readonly label: string;
      readonly icon?: string;
    }[];
  };

  readonly hooks?: {
    readonly beforeChange?: readonly any[];
    readonly afterChange?: readonly any[];
    readonly beforeDelete?: readonly any[];
    readonly afterDelete?: readonly any[];
  };

  readonly admin?: {
    readonly useAsTitle?: string;
    readonly defaultColumns?: readonly string[];
    readonly group?: string;
    readonly icon?: string;
    readonly hidden?: boolean | ((args: { user: any }) => boolean);
    readonly priority?: number;
    readonly tabs?: readonly {
      readonly name: string;
      readonly label: string;
      readonly icon?: string;
    }[];
    readonly sections?: readonly {
      readonly name: string;
      readonly label: string;
      readonly description?: string;
    }[];
    readonly previewPrefixSettingsKey?: string;
  };
}
