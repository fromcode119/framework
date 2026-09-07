import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import { QueueManager, LocalQueueAdapter, BullQueueAdapter } from '@fromcode119/queue';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';

/**
 * Which driver runs background jobs — the operator's choice, declared like every other integration.
 *
 * It used to be decided in code: a factory asked for "bull" whenever `REDIS_URL` was set, and a
 * server-only module registered the driver into a private registry. Nothing about that appeared in any
 * admin screen, so the running configuration could not be seen and could not be changed without a
 * redeploy — and when the registration was missing entirely, every deployment silently ran its jobs in
 * memory instead.
 *
 * `resolveFromEnv` keeps existing deployments behaving exactly as before until someone saves a choice.
 */
export class QueueIntegrationDefinition {
  static readonly definition: IIntegrationTypeDefinition<QueueManager> = {
    key: 'queue',
    label: 'Background Jobs',
    description: 'Runs scheduled tasks and plugin jobs. Redis survives restarts and is shared between instances.',
    defaultProvider: 'local',
    resolveFromEnv: () => {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        return { provider: 'bull', config: { url: redisUrl } };
      }
      return { provider: 'local', config: {} };
    },
    providers: [
      {
        key: 'local',
        label: 'In-Process',
        description: 'Runs jobs in this process. They do not survive a restart and are not shared between instances.',
        create: () => new QueueManager(new LocalQueueAdapter()),
      },
      {
        key: 'bull',
        label: 'Redis (BullMQ)',
        description: 'Queues jobs in Redis, so they survive a restart, retry on failure, and are shared between instances.',
        fields: [
          {
            name: 'url',
            label: 'Redis URL',
            type: IntegrationConfigFieldType.TEXT,
            required: true,
            placeholder: 'redis://localhost:6379',
          },
          {
            name: 'namespace',
            label: 'Key Namespace',
            type: IntegrationConfigFieldType.TEXT,
            required: false,
            placeholder: 'fromcode',
          },
        ],
        create: (config: any) => new QueueManager(
          new BullQueueAdapter(String(config?.url ?? ''), String(config?.namespace ?? '') || undefined),
        ),
      },
    ],
  };
}
