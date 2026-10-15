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
   * Put a STARTING entry into an integration type's list — created only when no entry with that id, and no entry
   * of that provider, exists; nothing that exists is ever changed. The provider must already be registered.
   * `created: false` with `reason: 'no_site'` means a multi-site deployment had no site selected (a pass that
   * belongs to nobody), so nothing was written. The operator completes the entry in Settings → Integrations.
   */
  ensureEntry(
    typeKey: string,
    entry: { id?: string; providerKey: string; name?: string; enabled?: boolean; config?: Record<string, any> },
  ): Promise<{ created: boolean; id: string; reason?: string }>;

  /**
   * Resolve and instantiate an integration from a specific provider config.
   * Stored password fields are decrypted before provider creation.
   *
   * A plugin reads a saved entry with its secrets masked, so a config built from one carries the placeholder
   * where the password is. Name the entry (`providerId`) and each placeholder is replaced by that entry's own
   * stored secret, for the plugin that registered the provider; without it, only when the provider has exactly
   * one saved entry.
   */
  instantiateWithConfig<T = any>(
    typeKey: string,
    providerKey: string,
    config?: Record<string, any>,
    options?: { providerId?: string },
  ): Promise<{ instance: T; resolved: any }>;
}
