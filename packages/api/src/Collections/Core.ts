import { Collection } from '@fromcode/core';
import { MediaCollection as Media } from '@fromcode/media';

export const UserCollection: Collection = {
  slug: 'users',
  name: 'Users',
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

export { Media as MediaCollection };

export const SettingsCollection: Collection = {
  slug: 'settings',
  name: 'Global Settings',
  tableName: '_system_meta',
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
