import type { Collection } from '../types';
import { SystemConstants } from '../constants';

export class RecordVersions {
  static readonly collection: Collection = {
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
        type: 'text',
        required: true,
      },
      {
        name: 'ref_collection',
        type: 'text',
        required: true,
      },
      {
        name: 'version',
        type: 'number',
        required: true,
        defaultValue: 1,
      },
      {
        name: 'version_data',
        type: 'json',
        required: true,
      },
      {
        name: 'updated_by',
        type: 'relationship',
        relationTo: 'users',
      },
      {
        name: 'change_summary',
        type: 'text',
      }
    ],
  };

  // Backward compat accessor
  static get slug(): string {
    return this.collection.slug;
  }
}
