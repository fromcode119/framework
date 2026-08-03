import { ICollection } from '@core/interfaces/collection.interface';
import type { IEntityInputAlias } from '@core/interfaces/entity-input-alias.interface';
import type { IEntityIndex } from '@core/interfaces/entity-index.interface';
import type { IEntityDerivedField } from '@core/interfaces/entity-derived-field.interface';
import type { IEntityApiOptions } from '@core/interfaces/entity-api-options.interface';
import type { IEntityAdminLayout } from '@core/interfaces/entity-admin-layout.interface';

export interface IEntityDefinition extends ICollection {
  indexes?: IEntityIndex[];
  inputAliases?: IEntityInputAlias[];
  derivedFields?: IEntityDerivedField[];
  api?: IEntityApiOptions;
  adminLayout?: IEntityAdminLayout;
}
