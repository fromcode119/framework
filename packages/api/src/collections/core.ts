import { type Collection, SystemConstants } from '@fromcode119/core';
import { MediaCollection } from '@fromcode119/media';

export class CoreCollections {
  static readonly user: Collection = {
    slug: 'users',
    name: 'Users',
    tableName: SystemConstants.TABLE.USERS,
    system: true,
    fields: [
      { name: 'email', label: 'E-Mail', type: 'text', required: true, unique: true },
      { name: 'username', label: 'Username', type: 'text', unique: true },
      { name: 'password', label: 'Password', type: 'password', required: true, admin: { hidden: true } },
      { name: 'roles', label: 'Roles', type: 'json', admin: { component: 'Tags' } },
      { name: 'permissions', label: 'Permissions', type: 'json', admin: { component: 'Tags' } },
      { name: 'firstName', label: 'First Name', type: 'text' },
      { name: 'lastName', label: 'Last Name', type: 'text' }
    ],
    admin: {
      priority: 1,
      group: 'Platform',
      icon: 'Users',
      useAsTitle: 'email',
      defaultColumns: ['email', 'username', 'roles', 'createdAt']
    }
  };

  // Cast needed: MediaCollection.schema is typed without importing core's Collection
  // (media cannot import core's Collection type due to tsconfig reference direction).
  // The shape is structurally valid — this cast is safe.
  static readonly media: Collection = MediaCollection.schema as unknown as Collection;

  static readonly settings: Collection = {
    slug: 'settings',
    name: 'Global Settings',
    tableName: SystemConstants.TABLE.META,
    primaryKey: 'key',
    timestamps: false,
    system: true,
    fields: [
      { name: 'key', label: 'Setting Key', type: 'text', required: true, unique: true, admin: { readOnly: true } },
      { name: 'value', label: 'Value', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', admin: { readOnly: true } },
      { name: 'group', label: 'Group', type: 'text', admin: { readOnly: true } },
      { name: 'updatedAt', label: 'Updated At', type: 'date', admin: { readOnly: true } }
    ],
    admin: {
      priority: 3,
      group: 'Settings',
      icon: 'Settings',
      useAsTitle: 'key',
      defaultColumns: ['key', 'value', 'group', 'updatedAt']
    }
  };
}
