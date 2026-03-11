export type IntegrationConfigFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';

export type IntegrationConfigField = {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

export type IntegrationProviderDefinition<TInstance = any> = {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: any }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
};

export type IntegrationTypeDefinition<TInstance = any> = {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers?: IntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
};
