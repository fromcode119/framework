import { ICollection } from '@core/interfaces/collection.interface';
import type { IEntityInputAlias } from '@core/entity/interfaces/entity-input-alias.interface';
import type { IEntityIndex } from '@core/entity/interfaces/entity-index.interface';
import type { IEntityDerivedField } from '@core/entity/interfaces/entity-derived-field.interface';
import type { IEntityApiOptions } from '@core/entity/interfaces/entity-api-options.interface';
import type { IEntityAdminLayout } from '@core/entity/interfaces/entity-admin-layout.interface';

export interface IEntityDefinition extends ICollection {
  indexes?: IEntityIndex[];
  inputAliases?: IEntityInputAlias[];
  derivedFields?: IEntityDerivedField[];
  api?: IEntityApiOptions;
  adminLayout?: IEntityAdminLayout;
}
