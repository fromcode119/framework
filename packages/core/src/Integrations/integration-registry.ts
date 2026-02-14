import { Logger } from '../logging/logger';
import { sanitizeKey } from '../utils';

export type IntegrationConfigFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';

export interface IntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface IntegrationProviderDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: Logger }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
}

export interface IntegrationTypeDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers?: IntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
}

export interface IntegrationResolved<TInstance = any> {
  type: string;
  providerKey: string;
  provider: IntegrationProviderDefinition<TInstance>;
  config: Record<string, any>;
  source: 'stored' | 'env' | 'default';
}

export interface IntegrationTypeSummary {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: Array<{
    key: string;
    label: string;
    description?: string;
    fields?: IntegrationConfigField[];
  }>;
}

interface IntegrationTypeRuntime<TInstance = any> {
  definition: IntegrationTypeDefinition<TInstance>;
  providers: Map<string, IntegrationProviderDefinition<TInstance>>;
}

export class IntegrationRegistry {
  private readonly types = new Map<string, IntegrationTypeRuntime<any>>();
  private readonly logger: Logger;

  constructor(private readonly db: any, logger?: Logger) {
    this.logger = logger || new Logger({ namespace: 'integration-registry' });
  }

  registerType<TInstance = any>(definition: IntegrationTypeDefinition<TInstance>) {
    const key = this.normalize(definition.key);
    if (!key) throw new Error('Integration type key is required');
    if (!definition.defaultProvider) {
      throw new Error(`Integration type "${key}" must declare a defaultProvider`);
    }

    const runtime: IntegrationTypeRuntime<TInstance> = {
      definition: {
        ...definition,
        key
      },
      providers: new Map()
    };

    this.types.set(key, runtime as IntegrationTypeRuntime<any>);
    for (const provider of definition.providers || []) {
      this.registerProvider(key, provider);
    }
  }

  registerProvider<TInstance = any>(typeKey: string, provider: IntegrationProviderDefinition<TInstance>) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const key = this.normalize(provider.key);
    if (!key) throw new Error(`Integration provider key is required for type "${normalizedType}"`);

    runtime.providers.set(key, {
      ...provider,
      key
    });
  }

  listTypes(): IntegrationTypeSummary[] {
    return Array.from(this.types.values()).map((runtime) => ({
      key: runtime.definition.key,
      label: runtime.definition.label,
      description: runtime.definition.description,
      defaultProvider: this.normalize(runtime.definition.defaultProvider),
      providers: Array.from(runtime.providers.values()).map((provider) => ({
        key: provider.key,
        label: provider.label,
        description: provider.description,
        fields: provider.fields || []
      }))
    }));
  }

  getTypeSummary(typeKey: string): IntegrationTypeSummary | null {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;

    return {
      key: runtime.definition.key,
      label: runtime.definition.label,
      description: runtime.definition.description,
      defaultProvider: this.normalize(runtime.definition.defaultProvider),
      providers: Array.from(runtime.providers.values()).map((provider) => ({
        key: provider.key,
        label: provider.label,
        description: provider.description,
        fields: provider.fields || []
      }))
    };
  }

  async resolve<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean } = {}
  ): Promise<IntegrationResolved<TInstance>> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const preferStored = options.preferStored !== false;
    const stored = preferStored ? await this.readStored(normalizedType) : null;
    const envCandidate = runtime.definition.resolveFromEnv?.() || null;

    let source: IntegrationResolved['source'] = 'default';
    let providerKey = this.normalize(runtime.definition.defaultProvider);
    let config: Record<string, any> = {};

    if (stored?.providerKey && runtime.providers.has(stored.providerKey)) {
      providerKey = stored.providerKey;
      config = stored.config || {};
      source = 'stored';
    } else if (stored?.providerKey && !runtime.providers.has(stored.providerKey)) {
      this.logger.warn(
        `Stored provider "${stored.providerKey}" for integration "${normalizedType}" is not registered. Falling back.`
      );
    }

    if (source === 'default' && envCandidate?.provider) {
      const envProvider = this.normalize(envCandidate.provider);
      if (runtime.providers.has(envProvider)) {
        providerKey = envProvider;
        config = envCandidate.config || {};
        source = 'env';
      } else {
        this.logger.warn(
          `Environment provider "${envProvider}" for integration "${normalizedType}" is not registered. Using default provider.`
        );
      }
    }

    const provider = runtime.providers.get(providerKey);
    if (!provider) {
      throw new Error(
        `Integration "${normalizedType}" provider "${providerKey}" is not registered. Available: ${Array.from(runtime.providers.keys()).join(', ')}`
      );
    }

    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig(config || {}) : (config || {});

    return {
      type: normalizedType,
      providerKey,
      provider,
      config: normalizedConfig,
      source
    };
  }

  async instantiate<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {}
  ): Promise<{ instance: TInstance; resolved: IntegrationResolved<TInstance> }> {
    const resolved = await this.resolve<TInstance>(typeKey, { preferStored: options.preferStored });
    const instance = await resolved.provider.create(resolved.config, options.context);
    return { instance, resolved };
  }

  async updateStoredConfig(typeKey: string, providerKey: string, config: Record<string, any> = {}) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const normalizedProvider = this.normalize(providerKey);
    const provider = runtime.providers.get(normalizedProvider);
    if (!provider) {
      throw new Error(
        `Integration "${normalizedType}" provider "${normalizedProvider}" is not registered`
      );
    }

    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig(config || {}) : (config || {});
    this.validateProviderConfig(typeKey, provider, normalizedConfig);
    await this.writeStored(normalizedType, normalizedProvider, normalizedConfig);
  }

  async readStoredConfig(typeKey: string): Promise<{ providerKey: string; config: Record<string, any> } | null> {
    const normalizedType = this.normalize(typeKey);
    return this.readStored(normalizedType);
  }

  private async readStored(typeKey: string): Promise<{ providerKey: string; config: Record<string, any> } | null> {
    try {
      const providerRow = await this.db.findOne('_system_meta', { key: this.getProviderSettingKey(typeKey) });
      const configRow = await this.db.findOne('_system_meta', { key: this.getConfigSettingKey(typeKey) });

      const providerKey = this.normalize(String(providerRow?.value || ''));
      const rawConfig = String(configRow?.value || '').trim();
      const config = rawConfig ? this.safeParseJson(rawConfig, {}) : {};

      if (!providerKey) return null;
      return { providerKey, config };
    } catch (error: any) {
      this.logger.warn(
        `Failed to read integration settings for "${typeKey}": ${error?.message || String(error)}`
      );
      return null;
    }
  }

  private async writeStored(typeKey: string, providerKey: string, config: Record<string, any>) {
    const providerMeta = {
      key: this.getProviderSettingKey(typeKey),
      value: providerKey,
      group: 'integrations',
      description: `Active provider for ${typeKey} integration.`
    };

    const configMeta = {
      key: this.getConfigSettingKey(typeKey),
      value: JSON.stringify(config || {}),
      group: 'integrations',
      description: `JSON configuration for ${typeKey} integration provider.`
    };

    await this.upsertMeta(providerMeta);
    await this.upsertMeta(configMeta);
  }

  private async upsertMeta(entry: { key: string; value: string; group?: string; description?: string }) {
    const existing = await this.db.findOne('_system_meta', { key: entry.key });
    if (existing) {
      await this.db.update(
        '_system_meta',
        { key: entry.key },
        {
          value: entry.value,
          group: entry.group || existing.group || null,
          description: entry.description || existing.description || null,
          updatedAt: new Date()
        }
      );
      return;
    }

    await this.db.insert('_system_meta', {
      key: entry.key,
      value: entry.value,
      group: entry.group || 'integrations',
      description: entry.description || null
    });
  }

  private getProviderSettingKey(typeKey: string) {
    return `integration_${typeKey}_provider`;
  }

  private getConfigSettingKey(typeKey: string) {
    return `integration_${typeKey}_config`;
  }

  private normalize(value: string) {
    return sanitizeKey(value);
  }

  private safeParseJson(value: string, fallback: any) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  private validateProviderConfig(
    typeKey: string,
    provider: IntegrationProviderDefinition<any>,
    config: Record<string, any>
  ) {
    const fields = provider.fields || [];
    for (const field of fields) {
      const value = config?.[field.name];
      const isEmpty = value === undefined || value === null || String(value).trim() === '';

      if (field.required && isEmpty) {
        throw new Error(`Integration "${typeKey}" provider "${provider.key}" requires field "${field.name}".`);
      }

      if (field.type === 'number' && !isEmpty && Number.isNaN(Number(value))) {
        throw new Error(`Integration "${typeKey}" provider "${provider.key}" field "${field.name}" must be a number.`);
      }
    }
  }
}
