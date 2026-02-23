import { Collection } from '@fromcode119/sdk';
import { SystemTable } from '@fromcode119/sdk/internal';

export const WebhooksCollection: Collection = {
  slug: SystemTable.WEBHOOKS,
  admin: {
    group: 'Settings',
    icon: 'webhook',
    useAsTitle: 'name',
    defaultColumns: ['name', 'url', 'active', 'lastStatus', 'lastTriggeredAt'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      required: true,
    },
    {
        name: 'method',
        type: 'select',
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
      type: 'json', // Array of event patterns like ["collections:posts:afterCreate", "system:*"]
      required: true,
      admin: {
          component: 'Tags'
      }
    },
    {
      name: 'headers',
      type: 'json', // Key-value pairs of custom headers
      defaultValue: {},
    },
    {
      name: 'secret',
      type: 'text',
      admin: {
        description: 'Used to sign the payload (X-Fromcode-Signature)',
      }
    },
    {
      name: 'active',
      type: 'boolean',
      defaultValue: true,
    },
    {
      name: 'lastTriggeredAt',
      type: 'date',
      admin: {
          readOnly: true
      }
    },
    {
      name: 'lastStatus',
      type: 'number',
      admin: {
          readOnly: true
      }
    },
    {
        name: 'lastResponse',
        type: 'textarea',
        admin: {
            readOnly: true,
            hidden: true
        }
    }
  ],
};

export default WebhooksCollection;
