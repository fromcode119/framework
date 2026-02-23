import { Collection } from '../types';
import { SystemTable } from '@fromcode/sdk/internal';

export const RecordVersions: Collection = {
  slug: SystemTable.RECORD_VERSIONS,
  shortSlug: 'versions',
  name: 'Record Versions',
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

export default RecordVersions;
