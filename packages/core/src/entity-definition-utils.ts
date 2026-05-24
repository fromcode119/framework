import type { Collection } from './types/schema.interfaces';
import type { EntityDefinition } from './types/entity.interfaces';

export class EntityDefinitionUtils {
  static define<TDefinition extends EntityDefinition>(definition: TDefinition): TDefinition {
    return definition;
  }

  static fromCollectionInput(input: Collection): EntityDefinition {
    return {
      ...input,
      fields: [...(input.fields || [])],
      admin: input.admin ? { ...input.admin } : undefined,
      access: input.access ? { ...input.access } : undefined,
      hooks: input.hooks ? { ...input.hooks } : undefined,
    };
  }
}
