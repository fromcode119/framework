import { Collection } from '@fromcode119/sdk';

export const MediaCollection: Collection = {
  slug: 'media',
  name: 'Media',
  admin: {
    useAsTitle: 'filename',
    group: 'Content',
    icon: 'Media',
  },
  fields: [
    {
      name: 'filename',
      type: 'text',
      required: true,
    },
    {
      name: 'originalName',
      type: 'text',
      required: true,
    },
    {
      name: 'mimeType',
      type: 'text',
      required: true,
    },
    {
      name: 'fileSize',
      type: 'number',
      required: true,
    },
    {
      name: 'width',
      type: 'number',
    },
    {
      name: 'height',
      type: 'number',
    },
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'folderId',
      type: 'number',
    },
    {
      name: 'path',
      type: 'text',
      required: true,
      admin: {
        hidden: true,
      }
    },
    {
      name: 'provider',
      type: 'text',
      required: true,
      defaultValue: 'local'
    },
    {
      name: 'integration',
      type: 'text',
      required: true,
      defaultValue: 'storage'
    }
  ],
};

export default MediaCollection;
