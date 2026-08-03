import type { ICollection } from '@core/interfaces/collection.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { FieldType } from '@core/enums/field-type.enum';

export class RecordVersions {
  static readonly collection: ICollection = {
    slug: SystemConstants.TABLE.RECORD_VERSIONS,
    shortSlug: 'versions',
    displayName: 'Record Versions',
    system: true,
    admin: {
      useAsTitle: 'id',
      group: 'Governance',
      hidden: true,
    },
    fields: [
      {
        name: 'ref_id',
        type: FieldType.TEXT,
        required: true,
      },
      {
        name: 'ref_collection',
        type: FieldType.TEXT,
        required: true,
      },
      {
        name: 'version',
        type: FieldType.NUMBER,
        required: true,
        defaultValue: 1,
      },
      {
        name: 'version_data',
        type: FieldType.JSON,
        required: true,
      },
      {
        name: 'updated_by',
        type: FieldType.RELATIONSHIP,
        relationTo: 'users',
      },
      {
        name: 'change_summary',
        type: FieldType.TEXT,
      }
    ],
  };

  // Backward compat accessor
  static get slug(): string {
    return this.collection.slug;
  }
}
