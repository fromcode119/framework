import type { ICollection } from '@core/interfaces/collection.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { FieldType } from '@core/enums/field-type.enum';

export class WebhooksCollection {
  static readonly collection: ICollection = {
    slug: SystemConstants.TABLE.WEBHOOKS,
    admin: {
      group: 'Settings',
      icon: 'webhook',
      useAsTitle: 'name',
      defaultColumns: ['name', 'url', 'active', 'lastStatus', 'lastTriggeredAt'],
    },
    fields: [
      {
        name: 'name',
        type: FieldType.TEXT,
        required: true,
      },
      {
        name: 'url',
        type: FieldType.TEXT,
        required: true,
      },
      {
          name: 'method',
          type: FieldType.SELECT,
          defaultValue: 'POST',
          options: [
              { label: 'POST', value: 'POST' },
              { label: 'GET', value: 'GET' },
              { label: 'PUT', value: 'PUT' },
              { label: 'PATCH', value: 'PATCH' }
          ]
      },
      {
        name: 'events',
        type: FieldType.JSON, // Array of event patterns like ["collections:posts:afterCreate", "system:*"]
        required: true,
        admin: {
            component: 'Tags'
        }
      },
      {
        name: 'headers',
        type: FieldType.JSON, // Key-value pairs of custom headers
        defaultValue: {},
      },
      {
        name: 'secret',
        type: FieldType.PASSWORD,
        admin: {
          description: 'Used to sign the payload (X-Fromcode-Signature)',
        }
      },
      {
        name: 'active',
        type: FieldType.BOOLEAN,
        defaultValue: true,
      },
      {
        name: 'lastTriggeredAt',
        type: FieldType.DATE,
        admin: {
            readOnly: true
        }
      },
      {
        name: 'lastStatus',
        type: FieldType.NUMBER,
        admin: {
            readOnly: true
        }
      },
      {
          name: 'lastResponse',
          type: FieldType.TEXTAREA,
          admin: {
              readOnly: true,
              hidden: true
          }
      }
    ],
  };

  // Backward compat accessor
  static get slug(): string {
    return this.collection.slug;
  }
}
