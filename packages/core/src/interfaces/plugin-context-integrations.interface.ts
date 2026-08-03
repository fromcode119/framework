/**
 * The `context.integrations` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextIntegrations {
  /**
   * Register a new integration type (e.g. 'payment', 'search', 'sms')
   */
  registerType(definition: {
    key: string;
    label: string;
    description?: string;
    defaultProvider: string;
    providers?: any[];
    resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
  }): void;

  /**
   * Register a new provider for an existing integration type
   */
  registerProvider(typeKey: string, provider: {
    key: string;
    label: string;
    description?: string;
    fields?: any[];
    create: (config: Record<string, any>) => any | Promise<any>;
    normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
  }): void;

  /**
   * Resolve and instantiate an integration by its type key
   */
  get<T = any>(typeKey: string): Promise<T>;

  /**
   * Resolve and instantiate an integration from a specific provider config.
   * Stored password fields are decrypted before provider creation.
   */
  instantiateWithConfig<T = any>(
    typeKey: string,
    providerKey: string,
    config?: Record<string, any>
  ): Promise<{ instance: T; resolved: any }>;
}
