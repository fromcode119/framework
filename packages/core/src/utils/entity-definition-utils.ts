import type { ICollection } from '@core/interfaces/collection.interface';
import type { IEntityDefinition } from '@core/interfaces/entity-definition.interface';

export class EntityDefinitionUtils {
  static define<TDefinition extends IEntityDefinition>(definition: TDefinition): TDefinition {
    return definition;
  }

  static fromCollectionInput(input: ICollection): IEntityDefinition {
    return {
      ...input,
      fields: [...(input.fields || [])],
      admin: input.admin ? { ...input.admin } : undefined,
      access: input.access ? { ...input.access } : undefined,
      hooks: input.hooks ? { ...input.hooks } : undefined,
    };
  }
}
