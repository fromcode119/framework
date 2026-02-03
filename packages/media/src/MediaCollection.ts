import { Collection } from '@fromcode/sdk';

export const MediaCollection: Collection = {
  slug: 'media',
  name: 'Media',
  admin: {
    useAsTitle: 'filename',
    group: 'Content',
    icon: 'image',
  },
  fields: [
    {
      name: 'filename',
      type: 'text',
      required: true,
    },
    {
      name: 'mimeType',
      type: 'text',
      required: true,
    },
    {
      name: 'filesize',
      type: 'number',
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
      name: 'url',
      type: 'text',
      required: true,
    },
    {
      name: 'path',
      type: 'text',
      required: true,
      admin: {
        hidden: true,
      }
    }
  ],
};

export default MediaCollection;
