import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import { CacheManager, CacheFactory } from '@fromcode119/cache';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';

export class CacheIntegrationDefinition {
  static readonly definition: IIntegrationTypeDefinition<CacheManager> = {
  key: 'cache',
  label: 'System Cache',
  description: 'Provider used for system-level caching and plugin data storage.',
  defaultProvider: 'memory',
  resolveFromEnv: () => {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      return { provider: 'redis', config: { url: redisUrl } };
    }
    return { provider: 'memory', config: {} };
  },
  providers: [
    {
      key: 'memory',
      label: 'In-Memory',
      description: 'Stores cache data in local server memory. Not shared across instances.',
      create: () => new CacheManager(CacheFactory.create('memory', {}))
    },
    {
      key: 'redis',
      label: 'Redis',
      description: 'High-performance shared cache using Redis.',
      fields: [
        {
          name: 'url',
          label: 'Redis URL',
          type: IntegrationConfigFieldType.TEXT,
          required: true,
          placeholder: 'redis://localhost:6379'
        }
      ],
      create: (config) => new CacheManager(CacheFactory.create('redis', config))
    }
  ]
};
}
