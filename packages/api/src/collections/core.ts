import { type ICollection, SystemConstants } from '@fromcode119/core';
import { MediaCollection } from '@fromcode119/media';
import { FieldType } from '@fromcode119/core';

export class CoreCollections {
  static readonly user: ICollection = {
    slug: 'users',
    displayName: 'Users',
    tableName: SystemConstants.TABLE.USERS,
    system: true,
    fields: [
      { name: FieldType.EMAIL.value, label: 'E-Mail', type: FieldType.TEXT, required: true, unique: true },
      { name: 'username', label: 'Username', type: FieldType.TEXT, unique: true },
      { name: FieldType.PASSWORD.value, label: 'Password', type: FieldType.PASSWORD, required: true, admin: { hidden: true } },
      { name: 'roles', label: 'Roles', type: FieldType.JSON, admin: { component: 'Tags' } },
      { name: 'permissions', label: 'Permissions', type: FieldType.JSON, admin: { component: 'Tags' } },
      { name: 'firstName', label: 'First Name', type: FieldType.TEXT },
      { name: 'lastName', label: 'Last Name', type: FieldType.TEXT }
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
  static readonly media: ICollection = MediaCollection.schema as unknown as ICollection;

  static readonly settings: ICollection = {
    slug: 'settings',
    displayName: 'Global Settings',
    tableName: SystemConstants.TABLE.META,
    primaryKey: 'key',
    timestamps: false,
    system: true,
    fields: [
      { name: 'key', label: 'Setting Key', type: FieldType.TEXT, required: true, unique: true, admin: { readOnly: true } },
      { name: 'value', label: 'Value', type: FieldType.TEXT, required: true },
      { name: 'description', label: 'Description', type: FieldType.TEXTAREA, admin: { readOnly: true } },
      { name: FieldType.GROUP.value, label: 'Group', type: FieldType.TEXT, admin: { readOnly: true } },
      { name: 'updatedAt', label: 'Updated At', type: FieldType.DATE, admin: { readOnly: true } }
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
