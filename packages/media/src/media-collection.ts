/**
 * Media collection schema definition.
 * Uses an inferred type — the shape is structurally compatible with the
 * Collection interface in @fromcode119/core without creating a circular
 * tsconfig reference (core → media).
 */
export class MediaCollection {
  static readonly schema = {
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
        },
      },
      {
        name: 'provider',
        type: 'text',
        required: true,
        defaultValue: 'local',
      },
      {
        name: 'integration',
        type: 'text',
        required: true,
        defaultValue: 'storage',
      },
      {
        // Literal strings, not the MediaVisibility enum: core imports media, so media importing core
        // would close a circular tsconfig reference (see the note at the top of this file). The enum
        // lives in core and is used everywhere the value is READ; this schema only declares the column.
        // The value doubles as the storage-space name in MediaManager, so the two cannot drift.
        name: 'visibility',
        type: 'select',
        required: true,
        defaultValue: 'public',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
        admin: {
          description: 'Private files have no public URL and are only reachable through a share link.',
        },
      },
    ],
  };
}
